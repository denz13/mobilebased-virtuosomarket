import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type SidebarPalette = {
  card: string;
  border: string;
  text: string;
  muted: string;
};

type SidebarNavigationProps = {
  visible: boolean;
  slideAnim: Animated.Value;
  palette: SidebarPalette;
  onClose: () => void;
};

export default function SidebarNavigation({
  visible,
  slideAnim,
  palette,
  onClose,
}: SidebarNavigationProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateText = now.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const openCategories = () => {
    onClose();
    router.push("/(tabs)/categories");
  };

  const openProducts = () => {
    onClose();
    router.push("/(tabs)/products");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.drawerRoot}>
        <Pressable style={styles.drawerBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              backgroundColor: palette.card,
              borderRightColor: palette.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={["#00AEEF", "#0077C8", "#004A99"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.clockCard}
          >
            <View style={styles.clockIconShell}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.clockTextWrap}>
              <Text style={styles.clockLabel}>Current Time</Text>
              <Text style={styles.clockTime}>{timeText}</Text>
              <Text style={styles.clockDate}>{dateText}</Text>
            </View>
          </LinearGradient>

          <Pressable style={styles.drawerItem} onPress={openCategories}>
            <MaterialCommunityIcons
              name="shape-outline"
              size={23}
              color={palette.muted}
            />
            <Text style={[styles.drawerItemText, { color: palette.text }]}>
              Categories
            </Text>
          </Pressable>
          <Pressable style={styles.drawerItem} onPress={openProducts}>
            <MaterialCommunityIcons
              name="shopping-outline"
              size={23}
              color={palette.muted}
            />
            <Text style={[styles.drawerItemText, { color: palette.text }]}>
              Products
            </Text>
          </Pressable>

          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <Text style={[styles.footerText, { color: palette.muted }]}>
              All rights reserved.
            </Text>
            <Text style={[styles.footerCredit, { color: palette.text }]}>
              Made by Karen Faith Eyo
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    flexDirection: "row",
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawerPanel: {
    width: 300,
    height: "100%",
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 26,
    borderRightWidth: 1,
  },
  clockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 24,
    minHeight: 112,
    shadowColor: "#0077C8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 7,
  },
  clockIconShell: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.42)",
  },
  clockTextWrap: {
    flex: 1,
  },
  clockLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  clockTime: {
    color: "#FFFFFF",
    marginTop: 5,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  clockDate: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderRadius: 14,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    marginTop: "auto",
    borderTopWidth: 1,
    paddingTop: 18,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footerCredit: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
  },
});
