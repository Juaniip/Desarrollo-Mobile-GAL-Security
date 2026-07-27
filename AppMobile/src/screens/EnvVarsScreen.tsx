import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import axios from 'axios';

type EnvVar = { key: string; value: string };

export default function EnvVarsScreen({ navigation, route }: any) {
  const { apiUrl, jwt, containerId, containerName } = route.params;
  const headers = { Authorization: `Bearer ${jwt}` };

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEnvVars = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/containers/${containerId}/env`, { headers });
      const vars: EnvVar[] = Object.entries(res.data.env_vars).map(([key, value]) => ({
        key, value: value as string,
      }));
      setEnvVars(vars);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las variables de entorno.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [apiUrl, containerId, jwt, navigation]);

  useEffect(() => { fetchEnvVars(); }, [fetchEnvVars]);

  const updateVar = (index: number, field: 'key' | 'value', text: string) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: text };
    setEnvVars(updated);
  };

  const addVar = () => setEnvVars(prev => [...prev, { key: '', value: '' }]);

  const removeVar = (index: number) => {
    Alert.alert('Eliminar variable', `¿Eliminar "${envVars[index].key}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setEnvVars(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const saveEnvVars = () => {
    const invalidVars = envVars.filter(v => !v.key.trim());
    if (invalidVars.length > 0) {
      Alert.alert('Error', 'Todas las variables deben tener un nombre (clave).');
      return;
    }
    Alert.alert(
      '⚠️ Confirmar cambio',
      `El contenedor "${containerName}" será detenido y recreado con las nuevas variables de entorno. Esta operación puede tardar unos segundos. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aplicar', style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const env_vars: Record<string, string> = {};
              envVars.forEach(v => { if (v.key.trim()) env_vars[v.key.trim()] = v.value; });
              await axios.put(`${apiUrl}/containers/${containerId}/env`, { env_vars }, { headers });
              Alert.alert('Listo', `"${containerName}" fue recreado con las nuevas variables.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              const detail = error?.response?.data?.detail || 'No se pudo aplicar el cambio.';
              Alert.alert('Error', detail);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#9B59B6" style={{ flex: 1 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Variables de Entorno</Text>
        <Text style={styles.headerSub}>{containerName}</Text>
      </View>

      <View style={styles.warning}>
        <Text style={styles.warningText}>
          ⚠️ Guardar recreará el contenedor. Los datos no persistidos en volúmenes se perderán.
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={envVars}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={() => (
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>CLAVE</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>VALOR</Text>
              <View style={{ width: 36 }} />
            </View>
          )}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={item.key}
                onChangeText={text => updateVar(index, 'key', text)}
                placeholder="CLAVE"
                autoCapitalize="characters"
              />
              <TextInput
                style={[styles.input, { flex: 1.5, marginLeft: 6 }]}
                value={item.value}
                onChangeText={text => updateVar(index, 'value', text)}
                placeholder="valor"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeVar(index)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#27AE60' }]} onPress={addVar}>
                <Text style={styles.btnText}>+ Agregar variable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: saving ? '#95A5A6' : '#9B59B6', marginTop: 10 }]}
                onPress={saveEnvVars}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.btnText}>💾 Guardar y aplicar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#7F8C8D', marginTop: 10 }]} onPress={() => navigation.goBack()}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ padding: 15 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { padding: 20, backgroundColor: '#9B59B6' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#E8DAEF', fontSize: 13, marginTop: 4 },
  warning: { backgroundColor: '#FEF9E7', padding: 12, borderBottomWidth: 1, borderColor: '#F9E79F' },
  warningText: { color: '#B7950B', fontSize: 12 },
  tableHeader: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 },
  tableHeaderText: { fontSize: 11, fontWeight: 'bold', color: '#7F8C8D' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#DDE' },
  removeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginLeft: 6, backgroundColor: '#FDEDEC', borderRadius: 8 },
  removeBtnText: { color: '#E74C3C', fontWeight: 'bold' },
  footer: { marginTop: 12, paddingBottom: 40 },
  btn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
