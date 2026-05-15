import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { loadIsCustomer } from '@/lib/user-role';

export default function TabLayout() {
  const router = useRouter();
  const logoutBounce = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const [isCustomer, setIsCustomer] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    const refreshRole = async () => {
      const customer = await loadIsCustomer();
      if (!cancelled) setIsCustomer(customer);
    };
    void refreshRole();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshRole();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoutBounce, {
          toValue: -8,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(logoutBounce, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [logoutBounce]);

  const logout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.tint,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: colorScheme === 'dark' ? '#2A2E31' : '#E5E7EB',
          },
          sceneStyle: {
            backgroundColor: theme.background,
          },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: 'My Cart',
            href: isCustomer ? '/cart' : null,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <Animated.View
        style={[
          styles.logoutButton,
          {
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            borderColor: isDark ? '#374151' : '#E5E7EB',
            transform: [{ translateY: logoutBounce }],
          },
        ]}
      >
        <Pressable
          onPress={logout}
          style={styles.logoutPressable}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <MaterialCommunityIcons name="logout" size={24} color="#EF4444" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  logoutButton: {
    position: 'absolute',
    right: 18,
    bottom: 122,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  logoutPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
