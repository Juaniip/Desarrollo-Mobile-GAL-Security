import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

export default function ServerListScreen({ navigation, route }: any) {
  const { uid } = route.params;
  const [servers, setServers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const loadServers = useCallback(async () => {
    const data = await AsyncStorage.getItem(`gals_servers_${uid}`);
    if (data) setServers(JSON.parse(data));
  }, [uid]);

  useEffect(() => { 
    loadServers(); 
  }, [loadServers]);

  const addServer = async () => {
    if (!name || !url) return;
    const newServers = [...servers, { id: Date.now().toString(), name, url: url.trim() }];
    setServers(newServers);
    await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(newServers));
    setName(''); setUrl('');
  };

  // NUEVA FUNCIÓN: Eliminar servidor
  const removeServer = (serverId: string, serverName: string) => {
    Alert.alert(
      "Eliminar Entorno",
      `¿Estás seguro de que deseas desvincular el entorno "${serverName}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            const updatedServers = servers.filter(s => s.id !== serverId);
            setServers(updatedServers);
            await AsyncStorage.setItem(`gals_servers_${uid}`, JSON.stringify(updatedServers));
          }
        }
      ]
    );
  };

  const handleConnect = async (serverUrl: string) => {
    const jwt = await auth().currentUser?.getIdToken();
    navigation.navigate('Dashboard', { apiUrl: serverUrl, jwt });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Mis Entornos</Text>
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
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => (
          <TouchableOpacity style={styles.card} onPress={() => handleConnect(item.url)}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>🖥️ {item.name}</Text>
              <Text style={styles.cardUrl}>{item.url}</Text>
            </View>
            {/* NUEVO BOTÓN: Eliminar */}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeServer(item.id, item.name)}>
              <Text style={styles.deleteBtnText}>❌</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
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
  form: { padding: 20, backgroundColor: '#FFF', margin: 15, borderRadius: 10, elevation: 2 },
  input: { borderBottomWidth: 1, borderColor: '#CCC', marginBottom: 15, padding: 8 },
  btn: { backgroundColor: '#2980B9', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', padding: 20, marginHorizontal: 15, marginBottom: 10, borderRadius: 10, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
  cardUrl: { color: '#95A5A6', fontSize: 12 },
  deleteBtn: { padding: 10 }, // Estilo para el botón de borrar
  deleteBtnText: { fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#2C3E50', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabText: { fontSize: 24 }
});