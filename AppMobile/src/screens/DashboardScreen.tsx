import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Dimensions,
} from 'react-native';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 60;
const GRAPH_HEIGHT = 60;
const MAX_SAMPLES = 20;

type MetricSample = {
  cpu_percent: number;
  ram_percent: number;
  timestamp: number;
};

function TelemetryGraph({ samples, color, label }: { samples: number[]; color: string; label: string }) {
  if (samples.length < 2) {
    return (
      <View style={{ height: GRAPH_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#95A5A6', fontSize: 11 }}>Acumulando datos ({samples.length}/{MAX_SAMPLES})...</Text>
      </View>
    );
  }
  const max = 100;
  const points = samples.map((v, i) => {
    const x = (i / (samples.length - 1)) * GRAPH_WIDTH;
    const y = GRAPH_HEIGHT - (v / max) * GRAPH_HEIGHT;
    return `${x},${y}`;
  });
  const polyline = points.join(' ');
  const lastVal = samples[samples.length - 1];

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 11, color: '#7F8C8D' }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color }}>{lastVal}%</Text>
      </View>
      {/* Gráfico dibujado con Views posicionados absolutamente — sin SVG nativo, sin dependencias nuevas */}
      <View style={{ height: GRAPH_HEIGHT, backgroundColor: '#F8FAFC', borderRadius: 6, overflow: 'hidden' }}>
        {samples.map((v, i) => {
          if (i === 0) return null;
          const x1 = ((i - 1) / (samples.length - 1)) * GRAPH_WIDTH;
          const y1 = GRAPH_HEIGHT - (samples[i - 1] / max) * GRAPH_HEIGHT;
          const x2 = (i / (samples.length - 1)) * GRAPH_WIDTH;
          const y2 = GRAPH_HEIGHT - (v / max) * GRAPH_HEIGHT;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          return (
            <View
              key={i}
              style={{
                position: 'absolute', left: x1, top: y1 - 1,
                width: length, height: 2,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}
        {/* Punto del último valor */}
        <View style={{
          position: 'absolute',
          left: GRAPH_WIDTH - 5,
          top: GRAPH_HEIGHT - (lastVal / max) * GRAPH_HEIGHT - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
        }} />
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation, route }: any) {
  const { apiUrl, jwt, role } = route.params;
  const isAdmin = role === 'administrador';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MetricSample[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      const [cont, met] = await Promise.all([
        axios.get(`${apiUrl}/containers`, { headers }),
        axios.get(`${apiUrl}/metrics`, { headers }),
      ]);
      setData({ containers: cont.data.containers, metrics: met.data });
      // Acumular historial de telemetría (últimas MAX_SAMPLES muestras)
      setHistory(prev => {
        const sample: MetricSample = {
          cpu_percent: met.data.cpu_percent ?? 0,
          ram_percent: met.data.ram_percent ?? 0,
          timestamp: Date.now(),
        };
        const updated = [...prev, sample];
        return updated.slice(-MAX_SAMPLES);
      });
    } catch (error) {
      Alert.alert('Error de Conexión', 'No se pudo sincronizar con el nodo remoto.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [apiUrl, jwt, navigation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const controlContainer = async (id: string, action: string) => {
    if (!isAdmin) { Alert.alert('Permiso denegado', 'Tu rol de Operador solo permite visualizar.'); return; }
    try {
      await axios.post(`${apiUrl}/containers/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${jwt}` } });
      fetchData();
    } catch { Alert.alert('Error', 'La operación no pudo completarse.'); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2980B9" />;

  const cpuHistory = history.map(s => s.cpu_percent);
  const ramHistory = history.map(s => s.ram_percent);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Estado del Nodo</Text>
          <View style={[styles.roleBadge, isAdmin ? styles.badgeAdmin : styles.badgeOp]}>
            <Text style={styles.roleBadgeText}>{isAdmin ? 'Administrador' : 'Operador'}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={data?.containers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <View style={styles.content}>
            {/* Telemetría actual */}
            {data?.metrics && (
              <View style={styles.metricsCard}>
                <Text style={styles.metricsText}>CPU: {data.metrics.cpu_percent}% | Temp: {data.metrics.cpu_temp_c}°C</Text>
                <Text style={styles.metricsText}>RAM: {data.metrics.ram_used_gb} / {data.metrics.ram_total_gb} GB ({data.metrics.ram_percent}%)</Text>
              </View>
            )}

            {/* Gráfico de historial */}
            <View style={styles.graphCard}>
              <Text style={styles.graphTitle}>📈 Historial de Telemetría</Text>
              <TelemetryGraph samples={cpuHistory} color="#E74C3C" label="CPU" />
              <View style={{ height: 12 }} />
              <TelemetryGraph samples={ramHistory} color="#2980B9" label="RAM" />
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchData}>
                <Text style={styles.refreshBtnText}>↻ Actualizar</Text>
              </TouchableOpacity>
            </View>

            {!isAdmin && (
              <View style={styles.readOnlyBanner}>
                <Text style={styles.readOnlyText}>👁️ Modo solo lectura — rol Operador</Text>
              </View>
            )}
            <Text style={styles.sectionTitle}>Contenedores</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={[styles.statusBadge, item.status === 'running' ? styles.bgSuccess : styles.bgDanger]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.actions}>
              {isAdmin && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, item.status === 'running' ? styles.bgDanger : styles.bgSuccess]}
                    onPress={() => controlContainer(item.id, item.status === 'running' ? 'stop' : 'start')}
                  >
                    <Text style={styles.actionText}>{item.status === 'running' ? 'Stop' : 'Start'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.bgWarning]} onPress={() => controlContainer(item.id, 'restart')}>
                    <Text style={styles.actionText}>Restart</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.bgPurple]}
                    onPress={() => navigation.navigate('EnvVars', { apiUrl, jwt, containerId: item.id, containerName: item.name })}
                  >
                    <Text style={styles.actionText}>ENV</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, styles.bgInfo]}
                onPress={() => navigation.navigate('Logs', { apiUrl, jwt, role, containerId: item.id })}
              >
                <Text style={styles.actionText}>Logs</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RadialMenu', { apiUrl, jwt, role, from: 'Dashboard' })}
      >
        <Text style={styles.fabText}>⚙️</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, backgroundColor: '#2C3E50' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeAdmin: { backgroundColor: '#2980B9' },
  badgeOp: { backgroundColor: '#7F8C8D' },
  roleBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  content: { padding: 15 },
  metricsCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2 },
  metricsText: { fontSize: 13, color: '#7F8C8D', marginBottom: 4 },
  graphCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2 },
  graphTitle: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50', marginBottom: 12 },
  refreshBtn: { marginTop: 12, alignSelf: 'flex-end', backgroundColor: '#EAF0F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  refreshBtnText: { color: '#2980B9', fontSize: 12, fontWeight: 'bold' },
  readOnlyBanner: { backgroundColor: '#FEF5E7', padding: 10, borderRadius: 8, marginBottom: 12 },
  readOnlyText: { color: '#B9770E', fontSize: 12, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50', marginBottom: 8 },
  card: { backgroundColor: '#FFF', padding: 15, marginHorizontal: 15, marginBottom: 12, borderRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { fontWeight: 'bold', fontSize: 15, color: '#2C3E50', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#FFF', fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  bgSuccess: { backgroundColor: '#4CAF50' },
  bgDanger: { backgroundColor: '#F44336' },
  bgWarning: { backgroundColor: '#FF9800' },
  bgInfo: { backgroundColor: '#2196F3' },
  bgPurple: { backgroundColor: '#9B59B6' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabText: { fontSize: 24 },
});
