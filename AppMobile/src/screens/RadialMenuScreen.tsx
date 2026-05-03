import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';

export default function RadialMenuScreen({ navigation, route }: any) {
  const { apiUrl, jwt, from } = route.params || {};

  const handleLogout = async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />
      
      <View style={styles.menuContainer}>
        
        {/* BOTÓN 1: Dinámico (Auditoría o Volver) */}
        {(from === 'Dashboard' || from === 'Logs' || from === 'Audit') && (
          <TouchableOpacity 
            style={[styles.option, styles.posTopLeft]} 
            onPress={() => {
              if (from === 'Dashboard') {
                navigation.navigate('Audit', { apiUrl, jwt });
              } else {
                navigation.navigate('Dashboard', { apiUrl, jwt });
              }
            }}
          >
            <Text style={styles.icon}>{from === 'Dashboard' ? '🛡️' : '⬅️'}</Text>
            <Text style={styles.label}>{from === 'Dashboard' ? 'Auditoría' : 'Dashboard'}</Text>
          </TouchableOpacity>
        )}

        {/* BOTÓN 2: Llavero (Visible si no estás ya en el llavero) */}
        {from !== 'ServerList' && (
          <TouchableOpacity 
            style={[styles.option, styles.posTopCenter]} 
            onPress={() => navigation.navigate('ServerList')}
          >
            <Text style={styles.icon}>🔑</Text>
            <Text style={styles.label}>Nodos</Text>
          </TouchableOpacity>
        )}

        {/* BOTÓN 3: Salir (Siempre visible) */}
        <TouchableOpacity 
          style={[styles.option, from === 'ServerList' ? styles.posCenter : styles.posTopRight]} 
          onPress={handleLogout}
        >
          <Text style={styles.icon}>👤</Text>
          <Text style={styles.label}>Salir</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  menuContainer: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65 },
  closeBtn: { width: 65, height: 65, borderRadius: 33, backgroundColor: '#E74C3C', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  closeText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  option: { position: 'absolute', alignItems: 'center', width: 75 },
  icon: { fontSize: 28, backgroundColor: '#34495E', padding: 12, borderRadius: 30, overflow: 'hidden', textAlign: 'center' },
  label: { color: '#FFF', fontSize: 10, marginTop: 5, fontWeight: 'bold', textAlign: 'center' },
  posTopLeft: { bottom: 160, right: 10 },
  posTopCenter: { bottom: 120, right: 85 },
  posTopRight: { bottom: 40, right: 125 },
  posCenter: { bottom: 100, right: 10 }
});