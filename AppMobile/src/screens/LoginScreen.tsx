import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

// --- MOTOR DE ARRANQUE DE GOOGLE ---
// Esto era lo que faltaba: inicializar el cliente con tu llave secreta
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || (response as any).idToken;

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
    } catch (error) {
      console.error(error);
      Alert.alert('Error de Identidad', 'No pudimos validar tu cuenta de Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginBox}>
        <Text style={styles.title}>GALs Security</Text>
        <Text style={styles.subtitle}>Guardian Application Layer</Text>
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#333" /> : <Text style={styles.googleButtonText}>🛡️ Acceder con Google</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loginBox: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', color: '#2C3E50' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#7F8C8D', marginBottom: 50 },
  googleButton: { backgroundColor: '#FFF', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BDC3C7', elevation: 3 },
  googleButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 }
});