import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import axios from 'axios';

type GraphNode = {
  id: string;
  type: 'network' | 'container';
  label: string;
  driver?: string;
  is_exposed?: boolean;
  status?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  exposed: boolean;
};

type TopologyData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type Point = { x: number; y: number };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_HEIGHT = 72;
const TOP_PADDING = 30;
const COL_NETWORK_X = 64;
const COL_CONTAINER_X = SCREEN_WIDTH - 64;
const NODE_RADIUS = 24;

function GraphLine({ from, to, exposed }: { from: Point; to: Point; exposed: boolean }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  return (
    <View
      style={[
        styles.line,
        {
          left: from.x,
          top: from.y - 1,
          width: length,
          backgroundColor: exposed ? '#E74C3C' : '#2980B9',
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
}

function GraphNodeBubble({ node, position }: { node: GraphNode; position: Point }) {
  const isNetwork = node.type === 'network';
  const color = isNetwork
    ? node.is_exposed ? '#E74C3C' : '#27AE60'
    : node.status === 'running' ? '#2980B9' : '#95A5A6';

  return (
    <View
      style={[
        styles.nodeWrapper,
        { left: position.x - NODE_RADIUS, top: position.y - NODE_RADIUS },
      ]}
    >
      <View style={[styles.nodeCircle, { backgroundColor: color }]}>
        <Text style={styles.nodeIcon}>{isNetwork ? '🌐' : '📦'}</Text>
      </View>
      <Text style={styles.nodeLabel} numberOfLines={1}>
        {node.label}
      </Text>
    </View>
  );
}

export default function NetworkGraphScreen({ navigation, route }: any) {
  const { apiUrl, jwt, role } = route.params;
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTopology = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${jwt}` };
      const res = await axios.get(`${apiUrl}/topology`, { headers });
      setData(res.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error de Conexión', 'No se pudo obtener la topología de red del nodo.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, jwt]);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2980B9" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const networks = (data?.nodes ?? []).filter(n => n.type === 'network');
  const containers = (data?.nodes ?? []).filter(n => n.type === 'container');

  const positions: Record<string, Point> = {};
  networks.forEach((n, i) => {
    positions[n.id] = { x: COL_NETWORK_X, y: TOP_PADDING + i * ROW_HEIGHT + NODE_RADIUS };
  });
  containers.forEach((n, i) => {
    positions[n.id] = { x: COL_CONTAINER_X, y: TOP_PADDING + i * ROW_HEIGHT + NODE_RADIUS };
  });

  const rowCount = Math.max(networks.length, containers.length, 1);
  const diagramHeight = TOP_PADDING * 2 + rowCount * ROW_HEIGHT;

  const hasData = networks.length > 0 || containers.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Grafo de Dependencias de Red</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#27AE60' }]} />
          <Text style={styles.legendText}>Red aislada</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E74C3C' }]} />
          <Text style={styles.legendText}>Red expuesta (bridge/host)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2980B9' }]} />
          <Text style={styles.legendText}>Contenedor activo</Text>
        </View>
      </View>

      {!hasData ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay datos de topología para mostrar.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ height: diagramHeight }}>
          <View style={[styles.diagram, { height: diagramHeight }]}>
            {(data?.edges ?? []).map((edge, idx) => {
              const from = positions[edge.source];
              const to = positions[edge.target];
              if (!from || !to) return null;
              return <GraphLine key={`edge-${idx}`} from={from} to={to} exposed={edge.exposed} />;
            })}

            {[...networks, ...containers].map(node => (
              <GraphNodeBubble key={node.id} node={node} position={positions[node.id]} />
            ))}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RadialMenu', { apiUrl, jwt, role, from: 'NetworkGraph' })}
      >
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECEF',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: '#7F8C8D' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyText: { color: '#95A5A6', fontSize: 14, textAlign: 'center' },
  diagram: { width: '100%', position: 'relative' },
  line: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  nodeWrapper: { position: 'absolute', alignItems: 'center', width: NODE_RADIUS * 2 + 20 },
  nodeCircle: {
    width: NODE_RADIUS * 2,
    height: NODE_RADIUS * 2,
    borderRadius: NODE_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  nodeIcon: { fontSize: 18 },
  nodeLabel: {
    fontSize: 10,
    color: '#2C3E50',
    marginTop: 4,
    fontWeight: 'bold',
    textAlign: 'center',
    width: NODE_RADIUS * 2 + 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#2C3E50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  fabText: { fontSize: 24 },
});