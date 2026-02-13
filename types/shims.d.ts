declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare module 'react-native' {
  export const Button: any;
  export const StyleSheet: any;
  export const Text: any;
  export const View: any;
}

declare module '@react-navigation/native' {
  export const NavigationContainer: any;
}

declare module '@react-navigation/native-stack' {
  export type NativeStackScreenProps<ParamList, RouteName extends keyof ParamList> = {
    navigation: { navigate: (name: keyof ParamList, params?: any) => void };
    route: { params: ParamList[RouteName] };
  };

  export function createNativeStackNavigator<T>(): {
    Navigator: any;
    Screen: any;
  };
}
