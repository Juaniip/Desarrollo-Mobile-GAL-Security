import React, { useState, useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

import LoginScreen from './src/screens/LoginScreen';
import ServerListScreen from './src/screens/ServerListScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LogsScreen from './src/screens/LogsScreen';
import AuditScreen from './src/screens/AuditScreen';
import RadialMenuScreen from './src/screens/RadialMenuScreen';

export type RootStackParamList = {
  Login: undefined;
  ServerList: { uid: string };
  Dashboard: { apiUrl: string; jwt: string };
  Logs: { apiUrl: string; jwt: string; containerId: string };
  Audit: { apiUrl: string; jwt: string };
  RadialMenu: { 
    apiUrl?: string; 
    jwt?: string; 
    from: 'ServerList' | 'Dashboard' | 'Logs' | 'Audit' 
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((userState) => {
      setUser(userState);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, [initializing]);

  if (initializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2980B9" />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Group>
            <Stack.Screen name="ServerList" component={ServerListScreen} initialParams={{ uid: user.uid }} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Logs" component={LogsScreen} />
            <Stack.Screen name="Audit" component={AuditScreen} />
            <Stack.Screen 
              name="RadialMenu" 
              component={RadialMenuScreen} 
              options={{ presentation: 'transparentModal', animation: 'fade' }} 
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA'
  }
});