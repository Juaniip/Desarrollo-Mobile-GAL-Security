import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl, Modal, ScrollView,
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
  organization_id: string | null;
};

type Organization = {
  organization_id: string;
  name: string;
  environments: Environment[];
};

type Telemetry = {
  status: 'loading' | 'online' | 'offline';
  cpu_percent?: number;
  ram_percent?: number;
  cpu_temp_c?: number | string;
  alerts?: string[];
};

const CPU_THRESHOLD = 85;
const RAM_THRESHOLD = 85;
const TEMP_THRESHOLD = 75;

export default function ServerListScreen({ navigation, route }: any) {
  const { uid } = route.params;
  const [servers, setServers] = useState<Environment[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry>>({});
  const [collapsedOrgs, setCollapsedOrgs] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [orgModal, setOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const alertedRef = useRef<Record<string, boolean>>({});

  const getAuthHeaders = async () => {
    const jwt = await auth().currentUser?.getIdToken();
    return { Authorization: `Bearer ${jwt}` };
  };

  const fetchTelemetry = useCallback(async (envs: Environment[]) => {
    if (envs.length === 0) return;
    setTelemetry(prev => {
      const s: Record<string, Telemetry> = { ...prev };
      envs.forEach(e => { s[e.environment_id] = { status: 'loading' }; });
      return s;
    });
    const headers = await getAuthHeaders();
    const results = await Promise.allSettled(
      envs.map(env => Promise.all([
        axios.get(`${env.url}/metrics`, { headers, timeout: 5000 }),
        axios.get(`${env.url}/containers`, { headers, timeout: 5000 }),
      ]))
    );
    const newTelemetry: Record<string, Telemetry> = {};
    const newAlerts: string[] = [];
    results.forEach((result, idx) => {
      const env = envs[idx];
      const envId = env.environment_id;
      if (result.status !== 'fulfilled') { newTelemetry[envId] = { status: 'offline' }; return; }
      const [metricsRes, containersRes] = result.value;
      const m = metricsRes.data;
      const alerts: string[] = [];
      if (typeof m.cpu_percent === 'number' && m.cpu_percent >= CPU_THRESHOLD) alerts.push(`CPU crítico (${m.cpu_percent}%)`);
      if (typeof m.ram_percent === 'number' && m.ram_percent >= RAM_THRESHOLD) alerts.push(`RAM crítica (${m.ram_percent}%)`);
      if (typeof m.cpu_temp_c === 'number' && m.cpu_temp_c >= TEMP_THRESHOLD) alerts.push(`Temperatura crítica (${m.cpu_temp_c}°C)`);
      (containersRes.data.containers || []).forEach((c: any) => {
        if (c.status === 'exited' && c.exit_code !== 0 && c.exit_code != null)
          alerts.push(`Contenedor "${c.name}" se cayó (exit ${c.exit_code})`);
      });
      newTelemetry[envId] = { status: 'online', ...m, alerts };
      alerts.forEach(msg => {
        const key = `${envId}:${msg}`;
        if (!alertedRef.current[key]) { alertedRef.current[key] = true; newAlerts.push(`${env.name}: ${msg}`); }
      });
      Object.keys(alertedRef.current).forEach(key => {
        if (key.startsWith(`${envId}:`) && !alerts.some(a => key === `${envId}:${a}`))
          delete alertedRef.current[key];
      });
    });
    setTelemetry(prev => ({ ...prev, ...newTelemetry }));
    if (newAlerts.length > 0) Alert.alert('⚠️ Alertas de Infraestructura', newAlerts.join('\n'));
  }, []);

  const loadServers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [envsRes, orgsRes] = await Promise.all([
        axios.get(`${REGISTRY_URL}/environments/mine`, { headers }),
        axios.get(`${REGISTRY_URL}/organizations/mine`, { headers }),
      ]);
      setServers(envsRes.data.environments);
      setOrganizations(orgsRes.data.organizations);
      setDegraded(false);
      await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(envsRes.data.environments));
      fetchTelemetry(envsRes.data.environments);
    } catch (error) {
      const cached = await AsyncStorage.getItem(`gals_servers_${uid}`);
      if (cached) { const p = JSON.parse(cached); setServers(p); fetchTelemetry(p); }
      setDegraded(true);
    } finally { setLoading(false); setRefreshing(false); }
  }, [uid, fetchTelemetry]);

  useEffect(() => { loadServers(); }, [loadServers]);
  const onRefresh = () => { setRefreshing(true); loadServers(); };

  const addServer = async () => {
    if (!name || !url) return;
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(`${REGISTRY_URL}/environments`, { name, url: url.trim() }, { headers });
      const newServers = [...servers, res.data];
      setServers(newServers);
      await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(newServers));
      fetchTelemetry([res.data]);
      setName(''); setUrl('');
    } catch {
      Alert.alert('Error', 'No se pudo registrar el entorno en el Directorio.');
    }
  };

  const removeServer = (server: Environment) => {
    const isAdmin = server.role === 'administrador';
    Alert.alert(
      isAdmin ? 'Eliminar Entorno' : 'Abandonar Entorno',
      isAdmin ? `¿Eliminar "${server.name}"? También revoca el acceso de sus Operadores.`
              : `¿Abandonar "${server.name}"?`,
      [{ text: 'Cancelar', style: 'cancel' }, {
        text: isAdmin ? 'Eliminar' : 'Abandonar', style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            if (isAdmin) await axios.delete(`${REGISTRY_URL}/environments/${server.environment_id}`, { headers });
            else await axios.delete(`${REGISTRY_URL}/environments/${server.environment_id}/collaborators/${uid}`, { headers });
            const updated = servers.filter(s => s.environment_id !== server.environment_id);
            setServers(updated);
            await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(updated));
          } catch { Alert.alert('Error', 'No se pudo completar la operación.'); }
        },
      }]
    );
  };

  const handleShare = async (environmentId: string) => {
    if (!shareEmail.trim()) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(`${REGISTRY_URL}/environments/${environmentId}/share`, { email: shareEmail.trim() }, { headers });
      Alert.alert('Listo', `Acceso de Operador otorgado a ${shareEmail.trim()}.`);
      setShareEmail(''); setSharingId(null);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo compartir el entorno.');
    }
  };

  const handleConnect = async (server: Environment) => {
    const jwt = await auth().currentUser?.getIdToken();
    navigation.navigate('Dashboard', { apiUrl: server.url, jwt, role: server.role });
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(`${REGISTRY_URL}/organizations`, { name: newOrgName.trim() }, { headers });
      setOrganizations(prev => [...prev, { organization_id: res.data.organization_id, name: res.data.name, environments: [] }]);
      setNewOrgName(''); setOrgModal(false);
    } catch { Alert.alert('Error', 'No se pudo crear la organización.'); }
  };

  const deleteOrganization = (org: Organization) => {
    Alert.alert('Eliminar Organización', `¿Eliminar "${org.name}"? Los entornos quedarán sin agrupar.`,
      [{ text: 'Cancelar', style: 'cancel' }, {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            await axios.delete(`${REGISTRY_URL}/organizations/${org.organization_id}`, { headers });
            setOrganizations(prev => prev.filter(o => o.organization_id !== org.organization_id));
            setServers(prev => prev.map(s => s.organization_id === org.organization_id ? { ...s, organization_id: null } : s));
          } catch { Alert.alert('Error', 'No se pudo eliminar la organización.'); }
        },
      }]
    );
  };

  const assignToOrg = async (environmentId: string, orgId: string | null) => {
    try {
      const headers = await getAuthHeaders();
      await axios.put(`${REGISTRY_URL}/environments/${environmentId}/organization`, { organization_id: orgId }, { headers });
      setServers(prev => prev.map(s => s.environment_id === environmentId ? { ...s, organization_id: orgId } : s));
      setAssignModal(null);
      loadServers();
    } catch { Alert.alert('Error', 'No se pudo asignar la organización.'); }
  };

  const toggleOrg = (orgId: string) => {
    setCollapsedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const renderTelemetry = (envId: string) => {
    const t = telemetry[envId];
    if (!t || t.status === 'loading') return (
      <View style={styles.telemetryRow}><ActivityIndicator size="small" color="#95A5A6" /><Text style={styles.telemetryText}> Sincronizando...</Text></View>
    );
    if (t.status === 'offline') return (
      <View style={styles.telemetryRow}><View style={[styles.dot, styles.dotOffline]} /><Text style={[styles.telemetryText, { color: '#E74C3C' }]}>Sin conexión</Text></View>
    );
    return (
      <View style={styles.telemetryRow}>
        <View style={[styles.dot, styles.dotOnline]} />
        <Text style={styles.telemetryText}>CPU {t.cpu_percent ?? '--'}% · RAM {t.ram_percent ?? '--'}% · {t.cpu_temp_c ?? '--'}°C</Text>
      </View>
    );
  };

  const renderEnvCard = (item: Environment) => {
    const t = telemetry[item.environment_id];
    const hasAlerts = t?.status === 'online' && t.alerts && t.alerts.length > 0;
    return (
      <View key={item.environment_id}>
        <TouchableOpacity style={styles.card} onPress={() => handleConnect(item)}>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>🖥️ {item.name}</Text>
              <View style={[styles.roleBadge, item.role === 'administrador' ? styles.badgeAdmin : styles.badgeOp]}>
                <Text style={styles.roleBadgeText}>{item.role === 'administrador' ? 'Admin' : 'Op'}</Text>
              </View>
            </View>
            {renderTelemetry(item.environment_id)}
            {hasAlerts && (
              <View style={styles.alertBanner}>
                {t!.alerts!.map((a, i) => <Text key={i} style={styles.alertText}>⚠️ {a}</Text>)}
              </View>
            )}
          </View>
          <View style={styles.cardActions}>
            {item.role === 'administrador' && (
              <>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setAssignModal(item.environment_id)}>
                  <Text style={styles.actionBtnText}>📁</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setSharingId(sharingId === item.environment_id ? null : item.environment_id)}>
                  <Text style={styles.actionBtnText}>🔗</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => removeServer(item)}>
              <Text style={styles.actionBtnText}>❌</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {sharingId === item.environment_id && (
          <View style={styles.shareBox}>
            <TextInput style={styles.shareInput} placeholder="Email del Operador" value={shareEmail} onChangeText={setShareEmail} autoCapitalize="none" keyboardType="email-address" />
            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item.environment_id)}>
              <Text style={styles.btnText}>Invitar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Entornos sin organización
  const ungrouped = servers.filter(s => !s.organization_id);
  // Entornos por organización
  const orgMap: Record<string, Environment[]> = {};
  organizations.forEach(org => { orgMap[org.organization_id] = servers.filter(s => s.organization_id === org.organization_id); });

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#2980B9" style={{ flex: 1 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Mis Entornos</Text>
        {degraded && <Text style={styles.degradedText}>⚠️ Caché local — sin conexión al Directorio</Text>}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2980B9']} />}>
        {/* Formulario de nuevo entorno */}
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Nombre (ej. Pi 5)" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="URL (https://...)" value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TouchableOpacity style={styles.btn} onPress={addServer}><Text style={styles.btnText}>+ Vincular entorno</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#27AE60', marginTop: 8 }]} onPress={() => setOrgModal(true)}>
            <Text style={styles.btnText}>📁 Nueva organización</Text>
          </TouchableOpacity>
        </View>

        {/* Organizaciones con sus entornos */}
        {organizations.map(org => (
          <View key={org.organization_id} style={styles.orgSection}>
            <TouchableOpacity style={styles.orgHeader} onPress={() => toggleOrg(org.organization_id)}>
              <Text style={styles.orgTitle}>{collapsedOrgs[org.organization_id] ? '▶' : '▼'} 📁 {org.name}</Text>
              <TouchableOpacity onPress={() => deleteOrganization(org)}>
                <Text style={styles.orgDelete}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {!collapsedOrgs[org.organization_id] && (
              <View style={styles.orgContent}>
                {(orgMap[org.organization_id] || []).length === 0
                  ? <Text style={styles.emptyOrg}>Sin entornos asignados</Text>
                  : (orgMap[org.organization_id] || []).map(renderEnvCard)}
              </View>
            )}
          </View>
        ))}

        {/* Entornos sin organización */}
        {ungrouped.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {organizations.length > 0 && <Text style={styles.sectionLabel}>Sin organización</Text>}
            {ungrouped.map(renderEnvCard)}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RadialMenu', { from: 'ServerList' })}>
        <Text style={styles.fabText}>⚙️</Text>
      </TouchableOpacity>

      {/* Modal: nueva organización */}
      <Modal visible={orgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva Organización</Text>
            <TextInput style={styles.modalInput} placeholder="Nombre (ej. Lab LINSI)" value={newOrgName} onChangeText={setNewOrgName} />
            <TouchableOpacity style={styles.btn} onPress={createOrganization}><Text style={styles.btnText}>Crear</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#95A5A6', marginTop: 8 }]} onPress={() => setOrgModal(false)}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: asignar organización */}
      <Modal visible={!!assignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Asignar a Organización</Text>
            {organizations.map(org => (
              <TouchableOpacity key={org.organization_id} style={[styles.btn, { marginBottom: 8 }]} onPress={() => assignToOrg(assignModal!, org.organization_id)}>
                <Text style={styles.btnText}>📁 {org.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#E74C3C', marginTop: 4 }]} onPress={() => assignToOrg(assignModal!, null)}>
              <Text style={styles.btnText}>Quitar de organización</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#95A5A6', marginTop: 8 }]} onPress={() => setAssignModal(null)}>
              <Text style={styles.btnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, backgroundColor: '#2C3E50' },
  headerText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  degradedText: { color: '#F5B041', fontSize: 11, marginTop: 6 },
  form: { padding: 15, backgroundColor: '#FFF', margin: 15, borderRadius: 10, elevation: 2 },
  input: { borderBottomWidth: 1, borderColor: '#CCC', marginBottom: 12, padding: 8 },
  btn: { backgroundColor: '#2980B9', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  orgSection: { marginHorizontal: 15, marginBottom: 8, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE' },
  orgHeader: { backgroundColor: '#EAF0F6', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orgTitle: { fontWeight: 'bold', color: '#2C3E50', fontSize: 15 },
  orgDelete: { color: '#E74C3C', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 6 },
  orgContent: { backgroundColor: '#F8FAFC', paddingTop: 4 },
  emptyOrg: { color: '#95A5A6', fontSize: 12, textAlign: 'center', padding: 14 },
  sectionLabel: { marginHorizontal: 15, marginBottom: 6, color: '#7F8C8D', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', padding: 16, marginHorizontal: 15, marginBottom: 8, borderRadius: 10, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  roleBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeAdmin: { backgroundColor: '#2980B9' },
  badgeOp: { backgroundColor: '#95A5A6' },
  roleBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  telemetryRow: { flexDirection: 'row', alignItems: 'center' },
  telemetryText: { color: '#7F8C8D', fontSize: 11, marginLeft: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOnline: { backgroundColor: '#27AE60' },
  dotOffline: { backgroundColor: '#E74C3C' },
  alertBanner: { marginTop: 6, backgroundColor: '#FDEDEC', borderRadius: 6, padding: 6 },
  alertText: { color: '#C0392B', fontSize: 11, fontWeight: 'bold' },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 6 },
  actionBtnText: { fontSize: 16 },
  shareBox: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 15, marginTop: -4, marginBottom: 10, padding: 12, borderRadius: 10, elevation: 1, alignItems: 'center' },
  shareInput: { flex: 1, borderBottomWidth: 1, borderColor: '#CCC', padding: 6, marginRight: 10 },
  shareBtn: { backgroundColor: '#27AE60', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabText: { fontSize: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#FFF', borderRadius: 14, padding: 24, width: '85%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 16 },
  modalInput: { borderBottomWidth: 1, borderColor: '#CCC', padding: 8, marginBottom: 16 },
});
