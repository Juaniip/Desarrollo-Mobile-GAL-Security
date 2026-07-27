import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function RadialMenuScreen({ navigation, route }: any) {
  const { apiUrl, jwt, role, from } = route.params || {};

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
    } catch (error) {
      console.error(error);
    }
  };

  const showBackOption =
    from === 'Dashboard' || from === 'Logs' || from === 'Audit' || from === 'NetworkGraph';
  const showTopologyOption = from !== 'ServerList';
  const showKeychainOption = from !== 'ServerList';

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />

      <View style={styles.menuContainer}>

        {showBackOption && (
          <TouchableOpacity
            style={[styles.option, styles.posBack]}
            onPress={() => {
              if (from === 'Dashboard') {
                navigation.navigate('Audit', { apiUrl, jwt, role });
              } else {
                navigation.navigate('Dashboard', { apiUrl, jwt, role });
              }
            }}
          >
            <Text style={styles.icon}>{from === 'Dashboard' ? '🛡️' : '⬅️'}</Text>
            <Text style={styles.label}>{from === 'Dashboard' ? 'Auditoría' : 'Dashboard'}</Text>
          </TouchableOpacity>
        )}

        {showTopologyOption && (
          <TouchableOpacity
            style={[styles.option, styles.posTopology]}
            onPress={() => navigation.navigate('NetworkGraph', { apiUrl, jwt, role })}
          >
            <Text style={styles.icon}>🌐</Text>
            <Text style={styles.label}>Topología</Text>
          </TouchableOpacity>
        )}

        {showKeychainOption && (
          <TouchableOpacity
            style={[styles.option, styles.posKeychain]}
            onPress={() => navigation.navigate('ServerList')}
          >
            <Text style={styles.icon}>🔑</Text>
            <Text style={styles.label}>Nodos</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.option, from === 'ServerList' ? styles.posExitCentered : styles.posExit]}
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
  posBack: { bottom: 210, right: 15 },
  posTopology: { bottom: 185, right: 105 },
  posKeychain: { bottom: 110, right: 160 },
  posExit: { bottom: 40, right: 185 },
  posExitCentered: { bottom: 100, right: 10 },
});