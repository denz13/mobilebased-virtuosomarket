import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { isInvalidRefreshTokenError, supabase } from "@/lib/supabase";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const routeBySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error && isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/auth/login");
        return;
      }

      if (data.session) {
        router.replace("/(tabs)");
        return;
      }
      router.replace("/auth/login");
    };

    routeBySession();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <ActivityIndicator size="large" color="#0077C8" />
    </View>
  );
}
