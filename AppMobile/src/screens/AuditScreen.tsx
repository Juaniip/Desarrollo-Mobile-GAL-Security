import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import axios from 'axios';

export default function AuditScreen({ navigation, route }: any) {
  const { apiUrl, jwt } = route.params;
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAudit = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      const res = await axios.get(`${apiUrl}/audit`, { headers });
      setAudit(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, jwt]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Reporte de Seguridad</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#2980B9" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreTitle}>Risk Score</Text>
            <Text style={[styles.scoreValue, audit?.risk_score > 70 ? styles.good : styles.bad]}>
              {audit?.risk_score || 0} / 100
            </Text>
          </View>
          {audit?.details.map((item: any, i: number) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>📦 {item.name}</Text>
              {item.warnings.map((w: string, idx: number) => (
                <Text key={idx} style={styles.warn}>⚠️ {w}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RadialMenu', { apiUrl, jwt, from: 'Audit' })}>
            <Text style={styles.fabText}>⚙️</Text>
        </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { backgroundColor: '#2C3E50', padding: 20 },
  headerText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 15 },
  scoreBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, alignItems: 'center', marginBottom: 20, elevation: 2 },
  scoreTitle: { fontSize: 18, fontWeight: 'bold', color: '#7F8C8D' },
  scoreValue: { fontSize: 48, fontWeight: 'bold' },
  good: { color: '#4CAF50' },
  bad: { color: '#F44336' },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#F5B041' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  warn: { fontSize: 13, color: '#D35400', marginTop: 2 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center' },
  fabText: { fontSize: 24 }
});