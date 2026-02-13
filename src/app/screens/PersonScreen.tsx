import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Person'>;

export function PersonScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{route.params.name}님과의 추억</Text>
      <Text>Person Screen (Sprint 0 placeholder)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
});
