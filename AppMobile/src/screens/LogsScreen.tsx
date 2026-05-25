import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import axios from 'axios';

export default function LogsScreen({ navigation, route }: any) {
  const { apiUrl, jwt, containerId } = route.params;
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      const res = await axios.get(`${apiUrl}/containers/${containerId}/logs`, { headers });
      setLogs(res.data.logs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, jwt, containerId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Consola: {containerId}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#2980B9" style={styles.loader} />
      ) : (
        <ScrollView style={styles.logsContainer}>
          <Text style={styles.logsText}>{logs || "No hay registros recientes."}</Text>
        </ScrollView>
      )}
      
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RadialMenu', { apiUrl, jwt, from: 'Logs' })}>
        <Text style={styles.fabText}>⚙️</Text>
    </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { backgroundColor: '#2C3E50', padding: 20 },
  headerText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logsContainer: { flex: 1, padding: 15 },
  logsText: { color: '#00FF00', fontFamily: 'monospace', fontSize: 12 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF' },
  fabText: { fontSize: 24 }
});