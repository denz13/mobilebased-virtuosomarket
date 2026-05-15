import { Dimensions, Platform, StyleSheet } from "react-native";

export const SCREEN_HEIGHT = Dimensions.get("window").height;
export const CARD_OVERLAP_TEAL = 36;
export const CARD_SHIFT_DOWN = 20;
export const CARD_TOP_RADIUS = 36;

export const LOGO_CYAN = "#00AEEF";
export const LOGO_MID = "#0077C8";
export const LOGO_NAVY = "#004A99";
export const HERO_GRADIENT = [LOGO_CYAN, LOGO_MID, LOGO_NAVY] as const;

export const PRIMARY = LOGO_CYAN;
export const WHITE = "#FFFFFF";
export const INPUT_BG = "#EFF6FB";
export const MUTED = "#9CA3AF";
export const TEXT_DARK = "#111827";

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGO_NAVY,
  },
  safeTop: {
    backgroundColor: "transparent",
  },
  hero: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: "flex-start",
  },
  heroContent: {
    width: "100%",
    alignItems: "center",
  },
  heroDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  decorIcon: {
    position: "absolute",
  },
  logoShell: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  brandName: {
    marginTop: 18,
    color: WHITE,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  heroTitle: {
    marginTop: 20,
    marginBottom: 28,
    paddingBottom: 4,
    color: WHITE,
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 44,
    textAlign: "center",
    maxWidth: 380,
    paddingHorizontal: 4,
    textShadowColor: "rgba(0,0,0,0.12)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardWrapAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: CARD_TOP_RADIUS,
    borderTopRightRadius: CARD_TOP_RADIUS,
    overflow: "hidden",
  },
  cardScrollView: {
    flex: 1,
    backgroundColor: WHITE,
  },
  cardScroll: {
    flexGrow: 1,
    backgroundColor: WHITE,
  },
  card: {
    flex: 1,
    backgroundColor: WHITE,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
    marginBottom: 10,
  },
  signUpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  signUpMuted: {
    color: MUTED,
    fontSize: 16,
  },
  signUpLink: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 16,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === "ios" ? 17 : 14,
    marginBottom: 18,
    gap: 14,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: TEXT_DARK,
    paddingVertical: 0,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
    marginTop: 6,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  rememberLabel: {
    color: MUTED,
    fontSize: 16,
  },
  link: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 19,
    alignItems: "center",
    marginBottom: 28,
  },
  primaryBtnText: {
    color: WHITE,
    fontSize: 19,
    fontWeight: "700",
  },
});
