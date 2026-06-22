import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import { REGISTRY_URL } from '../config';

type Environment = {
  environment_id: string;
  name: string;
  url: string;
  role: 'administrador' | 'operador';
};

type Telemetry = {
  status: 'loading' | 'online' | 'offline';
  cpu_percent?: number;
  ram_percent?: number;
  cpu_temp_c?: number | string;
  alerts?: string[];
};

// Umbrales de "Sistema de Alertas por Anomalías" (RF-08).
const CPU_THRESHOLD = 85;
const RAM_THRESHOLD = 85;
const TEMP_THRESHOLD = 75;

export default function ServerListScreen({ navigation, route }: any) {
  const { uid } = route.params;
  const [servers, setServers] = useState<Environment[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry>>({});
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');

  // Recuerda qué alertas ya se mostraron, para no repetir el mismo aviso
  // en cada refresh mientras la condición persiste. No es estado de React
  // a propósito: no necesita re-render, solo persistir entre llamadas.
  const alertedRef = useRef<Record<string, boolean>>({});

  const getAuthHeaders = async () => {
    const jwt = await auth().currentUser?.getIdToken();
    return { Authorization: `Bearer ${jwt}` };
  };

  // Monitorización concurrente + alertas: le pide /metrics Y /containers a
  // TODOS los nodos del llavero al mismo tiempo (Promise.allSettled). Si un
  // nodo no responde, queda "offline" sin afectar a los demás. Si alguno
  // supera un umbral de recursos, o tiene un contenedor caído por error
  // (exit_code != 0, no detenido a propósito), dispara una alerta nueva.
  const fetchTelemetry = useCallback(async (envs: Environment[]) => {
    if (envs.length === 0) return;

    setTelemetry(prev => {
      const loadingState: Record<string, Telemetry> = { ...prev };
      envs.forEach(e => {
        loadingState[e.environment_id] = { status: 'loading' };
      });
      return loadingState;
    });

    const headers = await getAuthHeaders();
    const results = await Promise.allSettled(
      envs.map(env =>
        Promise.all([
          axios.get(`${env.url}/metrics`, { headers, timeout: 5000 }),
          axios.get(`${env.url}/containers`, { headers, timeout: 5000 }),
        ])
      )
    );

    const newTelemetry: Record<string, Telemetry> = {};
    const newAlertMessages: string[] = [];

    results.forEach((result, idx) => {
      const env = envs[idx];
      const envId = env.environment_id;

      if (result.status !== 'fulfilled') {
        newTelemetry[envId] = { status: 'offline' };
        return;
      }

      const [metricsRes, containersRes] = result.value;
      const metrics = metricsRes.data;
      const alerts: string[] = [];

      if (typeof metrics.cpu_percent === 'number' && metrics.cpu_percent >= CPU_THRESHOLD) {
        alerts.push(`CPU crítico (${metrics.cpu_percent}%)`);
      }
      if (typeof metrics.ram_percent === 'number' && metrics.ram_percent >= RAM_THRESHOLD) {
        alerts.push(`RAM crítica (${metrics.ram_percent}%)`);
      }
      if (typeof metrics.cpu_temp_c === 'number' && metrics.cpu_temp_c >= TEMP_THRESHOLD) {
        alerts.push(`Temperatura crítica (${metrics.cpu_temp_c}°C)`);
      }

      (containersRes.data.containers || []).forEach((c: any) => {
        if (c.status === 'exited' && c.exit_code !== 0 && c.exit_code !== null && c.exit_code !== undefined) {
          alerts.push(`Contenedor "${c.name}" se cayó (exit ${c.exit_code})`);
        }
      });

      newTelemetry[envId] = { status: 'online', ...metrics, alerts };

      // Solo agrega al popup las alertas que NO estaban activas en el ciclo anterior.
      alerts.forEach(msg => {
        const alertKey = `${envId}:${msg}`;
        if (!alertedRef.current[alertKey]) {
          alertedRef.current[alertKey] = true;
          newAlertMessages.push(`${env.name}: ${msg}`);
        }
      });

      // Si una alerta vieja ya no está activa, se borra del registro para
      // que pueda volver a avisar si la condición se repite más adelante.
      Object.keys(alertedRef.current).forEach(key => {
        if (key.startsWith(`${envId}:`) && !alerts.some(a => key === `${envId}:${a}`)) {
          delete alertedRef.current[key];
        }
      });
    });

    setTelemetry(prev => ({ ...prev, ...newTelemetry }));

    if (newAlertMessages.length > 0) {
      Alert.alert('⚠️ Alertas de Infraestructura', newAlertMessages.join('\n'));
    }
  }, []);

  const loadServers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${REGISTRY_URL}/environments/mine`, { headers });
      setServers(res.data.environments);
      setDegraded(false);
      await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(res.data.environments));
      fetchTelemetry(res.data.environments);
    } catch (error) {
      console.error('No se pudo contactar al Registro, usando caché local:', error);
      const cached = await AsyncStorage.getItem(`gals_servers_${uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setServers(parsed);
        fetchTelemetry(parsed);
      }
      setDegraded(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, fetchTelemetry]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadServers();
  };

  const addServer = async () => {
    if (!name || !url) return;
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${REGISTRY_URL}/environments`,
        { name, url: url.trim() },
        { headers }
      );
      const newServers = [...servers, res.data];
      setServers(newServers);
      await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(newServers));
      fetchTelemetry([res.data]);
      setName('');
      setUrl('');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo registrar el entorno en el Directorio. Revisá tu conexión.');
    }
  };

  const removeServer = (server: Environment) => {
    const isAdmin = server.role === 'administrador';
    Alert.alert(
      isAdmin ? 'Eliminar Entorno' : 'Abandonar Entorno',
      isAdmin
        ? `¿Estás seguro de que deseas eliminar "${server.name}"? Esto también revoca el acceso de cualquier Operador.`
        : `¿Estás seguro de que deseas dejar de ver "${server.name}"? El Administrador deberá invitarte de nuevo si querés volver a acceder.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isAdmin ? 'Eliminar' : 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              if (isAdmin) {
                await axios.delete(`${REGISTRY_URL}/environments/${server.environment_id}`, { headers });
              } else {
                await axios.delete(
                  `${REGISTRY_URL}/environments/${server.environment_id}/collaborators/${uid}`,
                  { headers }
                );
              }
              const updatedServers = servers.filter(s => s.environment_id !== server.environment_id);
              setServers(updatedServers);
              await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(updatedServers));
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'No se pudo completar la operación en el Directorio.');
            }
          },
        },
      ]
    );
  };

  const handleShare = async (environmentId: string) => {
    if (!shareEmail.trim()) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${REGISTRY_URL}/environments/${environmentId}/share`,
        { email: shareEmail.trim() },
        { headers }
      );
      Alert.alert('Listo', `Se otorgó acceso de Operador a ${shareEmail.trim()}.`);
      setShareEmail('');
      setSharingId(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'No se pudo compartir el entorno.';
      Alert.alert('Error', detail);
    }
  };

  const handleConnect = async (server: Environment) => {
    const jwt = await auth().currentUser?.getIdToken();
    navigation.navigate('Dashboard', { apiUrl: server.url, jwt, role: server.role });
  };

  const renderTelemetry = (envId: string) => {
    const t = telemetry[envId];
    if (!t || t.status === 'loading') {
      return (
        <View style={styles.telemetryRow}>
          <ActivityIndicator size="small" color="#95A5A6" />
          <Text style={styles.telemetryText}>Sincronizando...</Text>
        </View>
      );
    }
    if (t.status === 'offline') {
      return (
        <View style={styles.telemetryRow}>
          <View style={[styles.statusDot, styles.dotOffline]} />
          <Text style={[styles.telemetryText, styles.telemetryOffline]}>Sin conexión</Text>
        </View>
      );
    }
    return (
      <View style={styles.telemetryRow}>
        <View style={[styles.statusDot, styles.dotOnline]} />
        <Text style={styles.telemetryText}>
          CPU {t.cpu_percent ?? '--'}% · RAM {t.ram_percent ?? '--'}% · {t.cpu_temp_c ?? '--'}°C
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2980B9" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Mis Entornos</Text>
        {degraded && (
          <Text style={styles.degradedText}>⚠️ Sin conexión al Directorio — mostrando datos cacheados</Text>
        )}
      </View>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Nombre (ej. Pi 5)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="URL (https://...)" value={url} onChangeText={setUrl} autoCapitalize="none" />
        <TouchableOpacity style={styles.btn} onPress={addServer}>
          <Text style={styles.btnText}>+ Vincular</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={servers}
        keyExtractor={(item: Environment) => item.environment_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2980B9']} />}
        renderItem={({ item }: { item: Environment }) => {
          const t = telemetry[item.environment_id];
          const hasAlerts = t?.status === 'online' && t.alerts && t.alerts.length > 0;
          return (
            <View>
              <TouchableOpacity style={styles.card} onPress={() => handleConnect(item)}>
                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>🖥️ {item.name}</Text>
                    <View
                      style={[
                        styles.roleBadge,
                        item.role === 'administrador' ? styles.roleBadgeAdmin : styles.roleBadgeOperator,
                      ]}
                    >
                      <Text style={styles.roleBadgeText}>
                        {item.role === 'administrador' ? 'Admin' : 'Operador'}
                      </Text>
                    </View>
                  </View>
                  {renderTelemetry(item.environment_id)}
                  {hasAlerts && (
                    <View style={styles.alertBanner}>
                      {t!.alerts!.map((a, i) => (
                        <Text key={i} style={styles.alertText}>⚠️ {a}</Text>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.cardActions}>
                  {item.role === 'administrador' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setSharingId(sharingId === item.environment_id ? null : item.environment_id)}
                    >
                      <Text style={styles.actionBtnText}>🔗</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => removeServer(item)}>
                    <Text style={styles.actionBtnText}>❌</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {sharingId === item.environment_id && (
                <View style={styles.shareBox}>
                  <TextInput
                    style={styles.shareInput}
                    placeholder="Email de Google del Operador"
                    value={shareEmail}
                    onChangeText={setShareEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item.environment_id)}>
                    <Text style={styles.btnText}>Invitar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RadialMenu', { from: 'ServerList' })}>
        <Text style={styles.fabText}>⚙️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, backgroundColor: '#2C3E50' },
  headerText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  degradedText: { color: '#F5B041', fontSize: 11, marginTop: 6 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 20, backgroundColor: '#FFF', margin: 15, borderRadius: 10, elevation: 2 },
  input: { borderBottomWidth: 1, borderColor: '#CCC', marginBottom: 15, padding: 8 },
  btn: { backgroundColor: '#2980B9', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
  telemetryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  telemetryText: { color: '#7F8C8D', fontSize: 12, marginLeft: 6 },
  telemetryOffline: { color: '#E74C3C' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#27AE60' },
  dotOffline: { backgroundColor: '#E74C3C' },
  alertBanner: { marginTop: 8, backgroundColor: '#FDEDEC', borderRadius: 6, padding: 8 },
  alertText: { color: '#C0392B', fontSize: 11, fontWeight: 'bold' },
  roleBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeAdmin: { backgroundColor: '#2980B9' },
  roleBadgeOperator: { backgroundColor: '#95A5A6' },
  roleBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 8 },
  actionBtnText: { fontSize: 16 },
  shareBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginTop: -4,
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    elevation: 1,
    alignItems: 'center',
  },
  shareInput: { flex: 1, borderBottomWidth: 1, borderColor: '#CCC', padding: 6, marginRight: 10 },
  shareBtn: { backgroundColor: '#27AE60', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#2C3E50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  fabText: { fontSize: 24 },
});