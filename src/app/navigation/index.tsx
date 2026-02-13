import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PersonScreen } from '../screens/PersonScreen';

export type RootStackParamList = {
  Home: undefined;
  Person: { name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
        <Stack.Screen name="Person" component={PersonScreen} options={{ title: '인물 상세' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
