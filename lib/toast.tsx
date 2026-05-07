import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  show: (opts: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(
    null
  );

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -10,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [opacity, scale, translateY]);

  const show = useCallback(
    (opts: ToastOptions) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      const next = {
        id: Date.now(),
        type: opts.type ?? "info",
        title: opts.title,
        message: opts.message,
        durationMs: opts.durationMs ?? 2800,
      };

      setToast(next);
      opacity.setValue(0);
      translateY.setValue(-10);
      scale.setValue(0.98);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          speed: 18,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 18,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();

      timer.current = setTimeout(hide, next.durationMs);
    },
    [hide, opacity, scale, translateY]
  );

  const value = useMemo(
    () => ({
      show,
      success: (message: string, title?: string) =>
        show({ type: "success", title, message }),
      error: (message: string, title?: string) =>
        show({ type: "error", title, message }),
      warning: (message: string, title?: string) =>
        show({ type: "warning", title, message }),
      info: (message: string, title?: string) =>
        show({ type: "info", title, message }),
      hide,
    }),
    [hide, show]
  );

  const type = toast?.type ?? "info";
  const meta = toastMeta[type];

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + 10,
              opacity,
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          <Pressable onPress={hide} style={styles.toast}>
            <View style={styles.row}>
              <View style={[styles.accentDot, meta.accent]} />
              <View style={[styles.iconWrap, meta.accent]}>
                <Text style={styles.icon}>{meta.icon}</Text>
              </View>
              <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>
                  {toast.title ?? meta.defaultTitle}
                </Text>
                <Text style={styles.message} numberOfLines={3}>
                  {toast.message}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(2, 6, 23, 0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "900",
    marginTop: -1,
  },
  content: {
    flex: 1,
  },
  accentSuccess: {
    backgroundColor: "#22C55E",
  },
  accentError: {
    backgroundColor: "#EF4444",
  },
  accentWarning: {
    backgroundColor: "#F59E0B",
  },
  accentInfo: {
    backgroundColor: "#60A5FA",
  },
  title: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  message: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});

const toastMeta: Record<
  ToastType,
  { icon: string; accent: ViewStyle; defaultTitle: string }
> = {
  success: {
    icon: "✓",
    accent: styles.accentSuccess,
    defaultTitle: "Success",
  },
  error: {
    icon: "!",
    accent: styles.accentError,
    defaultTitle: "Error",
  },
  warning: {
    icon: "!",
    accent: styles.accentWarning,
    defaultTitle: "Warning",
  },
  info: {
    icon: "i",
    accent: styles.accentInfo,
    defaultTitle: "Info",
  },
};
