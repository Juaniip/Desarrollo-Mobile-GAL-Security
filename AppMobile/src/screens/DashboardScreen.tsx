import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import axios from 'axios';

export default function DashboardScreen({ navigation, route }: any) {
  const { apiUrl, jwt } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      const [cont, met] = await Promise.all([
        axios.get(`${apiUrl}/containers`, { headers }),
        axios.get(`${apiUrl}/metrics`, { headers })
      ]);
      setData({ containers: cont.data.containers, metrics: met.data });
    } catch (error) {
      console.error(error);
      Alert.alert("Error de Conexión", "No se pudo sincronizar con el nodo remoto.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [apiUrl, jwt, navigation]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const controlContainer = async (id: string, action: string) => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      await axios.post(`${apiUrl}/containers/${id}/${action}`, {}, { headers });
      fetchData(); 
    } catch (error) {
      console.error(error); // <- Agregá esta línea
      Alert.alert('Error', 'La operación no pudo completarse.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2980B9" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estado del Nodo</Text>
      </View>
      
      <View style={styles.content}>
        {data?.metrics && (
          <View style={styles.metrics}>
            <Text style={styles.metricsText}>CPU: {data.metrics.cpu_percent}% | Temp: {data.metrics.cpu_temp_c}°C</Text>
            <Text style={styles.metricsText}>RAM: {data.metrics.ram_used_gb} GB / {data.metrics.ram_total_gb} GB ({data.metrics.ram_percent}%)</Text>
          </View>
        )}

        <FlatList 
          data={data?.containers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={[styles.statusBadge, item.status === 'running' ? styles.bgSuccess : styles.bgDanger]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, item.status === 'running' ? styles.bgDanger : styles.bgSuccess]} onPress={() => controlContainer(item.id, item.status === 'running' ? 'stop' : 'start')}>
                  <Text style={styles.actionText}>{item.status === 'running' ? 'Stop' : 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.bgWarning]} onPress={() => controlContainer(item.id, 'restart')}>
                  <Text style={styles.actionText}>Restart</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.bgInfo]} onPress={() => navigation.navigate('Logs', { apiUrl, jwt, containerId: item.id })}>
                  <Text style={styles.actionText}>Logs</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RadialMenu', { apiUrl, jwt, from: 'Dashboard' })}>
        <Text style={styles.fabText}>⚙️</Text>
    </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, backgroundColor: '#2C3E50' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  content: { flex: 1, padding: 15 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metrics: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  metricsText: { fontSize: 14, color: '#7F8C8D', marginBottom: 5 },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardName: { fontWeight: 'bold', fontSize: 16, color: '#2C3E50' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#FFF', fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { paddingVertical: 8, borderRadius: 4, flex: 1, marginHorizontal: 2, alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  bgSuccess: { backgroundColor: '#4CAF50' },
  bgDanger: { backgroundColor: '#F44336' },
  bgWarning: { backgroundColor: '#FF9800' },
  bgInfo: { backgroundColor: '#2196F3' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabText: { fontSize: 24 }
});