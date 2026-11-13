import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, BackHandler, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "./src/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import RegistrationFlow from "./src/components/RegistrationFlow";
import RoleApplicationFlow from "./src/components/RoleApplicationFlow";
import ServiceRequestsScreen from "./src/components/ServiceRequestsScreen";

type Category = { id: string; name: string; slug: string; icon: string; parent_id?: string | null; image_url?: string | null };
type Municipality = { id: string; name: string };
type Product = { id: string; name: string; description: string | null; price: number | string; image_url: string | null; branch_id: string; merchant: any; branch: any };
type Store = { id: string; name: string; branchName: string; categorySlug: string; municipalityId: string | null; area: string; count: number; image: string | null; isOpen: boolean };
type DriverDetails = { name: string; phone: string | null; vehicleType: string | null; plate: string | null; photoUrl: string | null };
type OrderEvent = { id: string; kind: "accepted" | "driver"; orderNumber: string; merchantName: string; recipientName: string; address: string; total: number; createdAt: string; driver?: DriverDetails | null };
type Order = { id: string; order_number: string; status: string; driver_user_id?: string | null; assigned_at?: string | null; address_snapshot?: any; driver?: DriverDetails | null; subtotal: number | string; delivery_fee: number | string; total: number | string; placed_at: string; payment_method: string; payment_status: string; gcash_payment_reference: string | null; gcash_payment_proof_path: string | null; gcash_payment_submitted_at: string | null; rider_on_way_at?: string | null; delivery_proof_path?: string | null; driver_note?: string | null; order_items?: any[]; history?: any[]; deliveryProofUrl?: string | null; merchants: any };
type Cart = Record<string, { product: Product; quantity: number }>;
type ServiceZone = { id: string; name: string; municipality_id: string };
type CustomerAddress = { id: string; label: string; recipient_name: string; recipient_phone: string; address_line: string; landmark: string | null; municipality_id: string; service_zone_id: string; municipalities: any; service_zones?: any };
type MerchantUsageSettings = { merchant_usage_enabled: boolean; merchant_usage_method: string; merchant_usage_value: number | string };
type Tab = "market" | "orders" | "account";

const NAVY = "#102e57";
const ORANGE = "#ff8a00";
const RED = "#e95718";
const BG = "#fff7ef";
const BRAND_LOGO = require("./src/assets/sugomate-wordmark.png");
const AndroidStatusBar = StatusBar as React.ComponentType<any>;
const peso = (v: number | string) => "₱" + Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;

function isStoreOpen(hours: any, temporarilyClosed: boolean) {
  if (temporarilyClosed) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  const day = part("weekday").toLowerCase().slice(0, 3);
  const slot = (hours ?? {})[day] ?? { open: "08:00", close: "20:00", closed: false };
  if (slot.closed) return false;
  const now = Number(part("hour")) * 60 + Number(part("minute"));
  const open = Number((slot.open ?? "08:00").slice(0, 2)) * 60 + Number((slot.open ?? "08:00").slice(3, 5));
  const close = Number((slot.close ?? "20:00").slice(0, 2)) * 60 + Number((slot.close ?? "20:00").slice(3, 5));
  return now >= open && now < close;
}

function categoryEmoji(slug: string) {
  const icons: Record<string, string> = { "food-meals": "🍽️", groceries: "🛒", "flower-shop": "💐", "drinks-desserts": "🥤", pharmacy: "💊", bakery: "🥐", hardware: "🛠️", "pabili-essentials": "🛍️" };
  return icons[slug] ?? "🏪";
}

const orderStatus: Record<string, string> = {
  pending_merchant: "Awaiting store", accepted: "Accepted · finding rider", preparing: "Preparing",
  ready_for_pickup: "Ready for pickup", assigned: "Driver assigned", picked_up: "Picked up",
  in_transit: "On the way", delivered: "Delivered", cancelled: "Cancelled", rejected: "Rejected"
};


const ORDER_PROGRESS_STAGES = ["Placed", "Accepted", "Preparing", "On the way", "Delivered"];
const ORDER_PROGRESS_INDEX: Record<string, number> = {
  pending_merchant: 0, accepted: 1, preparing: 2, ready_for_pickup: 2,
  assigned: 2, picked_up: 3, in_transit: 3, delivered: 4
};

function ProgressConnector({ active, complete }: { active: boolean; complete: boolean }) {
  const flow = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!active) return;
    const animation = Animated.loop(Animated.timing(flow, { toValue: 1, duration: 1150, useNativeDriver: true }));
    animation.start();
    return () => { animation.stop(); flow.setValue(0); };
  }, [active, flow]);
  const translateX = flow.interpolate({ inputRange: [0, 1], outputRange: [-18, Math.max(0, width - 18)] });
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.progressConnector, complete && styles.progressConnectorComplete, active && styles.progressConnectorActive]}>
    {active && <Animated.View style={[styles.progressFlowDash, { transform: [{ translateX }] }]} />}
  </View>;
}

function OrderProgressTracker({ status }: { status: string }) {
  const currentStep = ORDER_PROGRESS_INDEX[status] ?? 0;
  const pulse = useRef(new Animated.Value(0)).current;
  const cancelled = status === "cancelled" || status === "rejected";
  useEffect(() => {
    if (cancelled || status === "delivered") return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true })
    ]));
    animation.start();
    return () => { animation.stop(); pulse.setValue(0); };
  }, [cancelled, status, pulse]);
  if (cancelled) return null;
  return <View style={styles.progressTracker}>
    <View style={styles.progressTrackRow}>
      {ORDER_PROGRESS_STAGES.map((stage, index) => <React.Fragment key={stage}>
        <View style={styles.progressNodeWrap}>
          {index === currentStep && status !== "delivered" && <Animated.View style={[styles.progressPulse, {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.08] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }]
          }]} />}
          <View style={[styles.progressNode, (index < currentStep || status === "delivered") && styles.progressNodeComplete, index === currentStep && status !== "delivered" && styles.progressNodeCurrent]}>
            <Text style={[styles.progressNodeText, (index <= currentStep || status === "delivered") && styles.progressNodeTextActive]}>{index < currentStep || status === "delivered" ? "✓" : index + 1}</Text>
          </View>
        </View>
        {index < ORDER_PROGRESS_STAGES.length - 1 && <ProgressConnector active={index === currentStep - 1 && status !== "delivered"} complete={index < currentStep - 1 || status === "delivered"} />}
      </React.Fragment>)}
    </View>
    <View style={styles.progressLabelRow}>
      {ORDER_PROGRESS_STAGES.map((stage, index) => <View key={stage} style={styles.progressLabelWrap}>
        <Text numberOfLines={1} style={[styles.progressLabel, index < currentStep && styles.progressLabelComplete, index === currentStep && styles.progressLabelActive]}>{stage}</Text>
      </View>)}
    </View>
  </View>;
}

function CustomerApp() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [applicationRole, setApplicationRole] = useState<"merchant" | "driver" | null>(null);
  const [tab, setTab] = useState<Tab>("market");
  const [serviceRequestsOpen, setServiceRequestsOpen] = useState(false);
  const [serviceRequestsInitialType, setServiceRequestsInitialType] = useState<"papalit" | "pasugo" | null>(null);
  const [profileName, setProfileName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [merchantUsageSettings, setMerchantUsageSettings] = useState<MerchantUsageSettings>({ merchant_usage_enabled: false, merchant_usage_method: "percentage", merchant_usage_value: 0 });
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderEventQueue, setOrderEventQueue] = useState<OrderEvent[]>([]);
  const [activeOrderEvent, setActiveOrderEvent] = useState<OrderEvent | null>(null);
  const seenOrderEvents = useRef<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedParentCategory, setSelectedParentCategory] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gcashReference, setGcashReference] = useState<Record<string, string>>({});
  const [gcashProof, setGcashProof] = useState<Record<string, { uri: string; mimeType: string; fileName: string; size: number }>>({});
  const [gcashSubmitting, setGcashSubmitting] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [deliveryFeePreview, setDeliveryFeePreview] = useState<number | null>(null);
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "gcash">("cod");
  const [customerNote, setCustomerNote] = useState("");
  const [newAddress, setNewAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressMunicipality, setAddressMunicipality] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressLandmark, setAddressLandmark] = useState("");
  const [addressManagerOpen, setAddressManagerOpen] = useState(false);
  const [addressManagerBusy, setAddressManagerBusy] = useState(false);
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([]);
  const [addressServiceZone, setAddressServiceZone] = useState("");

  // Android system Back should unwind the customer's in-app screen state first.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (serviceRequestsOpen) { setServiceRequestsOpen(false); return true; }
      if (checkoutOpen) {
        if (!checkoutBusy) setCheckoutOpen(false);
        return true;
      }
      if (selectedStore) {
        setSelectedStore("");
        setSearch("");
        return true;
      }
      if (tab !== "market") {
        setTab("market");
        setSelectedStore("");
        return true;
      }
      if (selectedCategory && categories.some(c => c.parent_id === selectedParentCategory)) {
        setSelectedCategory("");
        return true;
      }
      if (selectedCategory || selectedParentCategory || selectedMunicipality || search) {
        setSelectedCategory("");
        setSelectedParentCategory("");
        setSelectedMunicipality("");
        setSearch("");
        return true;
      }
      // At the marketplace root, let Android handle the normal app-exit behavior.
      return false;
    });
    return () => subscription.remove();
  }, [serviceRequestsOpen, checkoutOpen, checkoutBusy, selectedStore, tab, selectedCategory, selectedParentCategory, selectedMunicipality, search, categories]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function resolveAccountRole() {
      if (!session?.user?.id) { if (active) setApplicationRole(null); return; }
      const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!active || error) return;
      const intended = session.user.user_metadata?.intended_role;
      if (intended === "merchant" || intended === "driver") { setApplicationRole(intended); return; }
      setApplicationRole(null);
    }
    resolveAccountRole();
    return () => { active = false; };
  }, [session?.user?.id]);

  const loadMarketplace = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const [profileRes, municipalityRes, categoryRes, usageSettingsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle(),
        supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
        supabase.from("merchant_categories").select("id,name,slug,icon,image_url,parent_id").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("platform_financial_settings").select("merchant_usage_enabled,merchant_usage_method,merchant_usage_value").eq("id", 1).maybeSingle()
      ]);
      if (profileRes.error) throw profileRes.error;
      if (municipalityRes.error) throw municipalityRes.error;
      if (usageSettingsRes.error) throw usageSettingsRes.error;
      setMerchantUsageSettings({
        merchant_usage_enabled: Boolean(usageSettingsRes.data?.merchant_usage_enabled),
        merchant_usage_method: usageSettingsRes.data?.merchant_usage_method ?? "percentage",
        merchant_usage_value: Number(usageSettingsRes.data?.merchant_usage_value ?? 0)
      });
      setProfileName(profileRes.data?.display_name?.trim() ?? "");
      setMunicipalities(municipalityRes.data ?? []);
      if (categoryRes.error) {
        const legacy = await supabase.from("merchant_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order").order("name");
        if (legacy.error) throw legacy.error;
        setCategories((legacy.data ?? []).map(c => ({ ...c, image_url: null })));
      } else setCategories((categoryRes.data ?? []).map(c => ({ ...c, icon: c.icon ?? "store" })));

      const makeQuery = (legacy: boolean) => {
        const select = legacy
          ? "id,name,description,price,image_url,branch_id,merchant:merchants!products_merchant_id_fkey(name,slug,logo_url,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey(name,municipality_id,municipalities(name))"
          : "id,name,description,price,image_url,branch_id,merchant:merchants!products_merchant_id_fkey(name,slug,logo_url,accepted_payment_methods,gcash_qr_url,gcash_payment_type,gcash_account_name,gcash_mobile_number,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey(name,municipality_id,store_hours,is_temporarily_closed,municipalities(name))";
        return supabase.from("products").select(select).eq("is_available", true).order("created_at", { ascending: false }).limit(400);
      };
      let result = await makeQuery(false);
      if (result.error) result = await makeQuery(true) as any;
      if (result.error) throw result.error;
      const rows: Product[] = ((result.data ?? []) as any[]).map(row => {
        const merchant = one(row.merchant);
        const branch = one(row.branch);
        return { ...row, merchant: merchant ? { ...merchant, store_category: one(merchant.store_category) } : null, branch: branch ? { ...branch, municipalities: one(branch.municipalities) } : null };
      });
      setProducts(rows);
      const map = new Map<string, Store>();
      for (const p of rows) {
        if (!p.branch_id) continue;
        const b = p.branch;
        const m = p.merchant;
        const old = map.get(p.branch_id);
        if (old) { old.count += 1; continue; }
        map.set(p.branch_id, {
          id: p.branch_id, name: m?.name ?? "Local store", branchName: b?.name ?? "",
          categorySlug: m?.store_category?.slug ?? "other", municipalityId: b?.municipality_id ?? null, area: b?.municipalities?.name ?? "",
          count: 1, image: m?.logo_url ?? null,
          isOpen: isStoreOpen(b?.store_hours, Boolean(b?.is_temporarily_closed))
        });
      }
      setStores([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      Alert.alert("Unable to load marketplace", e?.message ?? "Please try again.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [session?.user?.id]);

  const loadOrders = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("orders").select("id,order_number,status,driver_user_id,assigned_at,address_snapshot,subtotal,delivery_fee,total,placed_at,payment_method,payment_status,gcash_payment_reference,gcash_payment_proof_path,gcash_payment_submitted_at,rider_on_way_at,delivery_proof_path,driver_note,merchants(name,gcash_payment_type,gcash_account_name,gcash_mobile_number,gcash_qr_url),order_items(id,product_name,quantity,line_total)").eq("customer_id", session.user.id).order("placed_at", { ascending: false }).limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Order[];
      const ids = rows.map(order => order.id);
      const [{ data: events }, proofResults] = await Promise.all([
        ids.length ? supabase.from("order_status_history").select("id,order_id,to_status,note,created_at").in("order_id", ids).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as any[] }),
        Promise.all(rows.filter(order => order.delivery_proof_path).map(async order => {
          const { data: signed } = await supabase.storage.from("delivery-proofs").createSignedUrl(order.delivery_proof_path as string, 3600);
          return [order.id, signed?.signedUrl ?? null] as const;
        }))
      ]);
      const { data: driverRows, error: driverError } = ids.length
        ? await supabase.rpc("customer_order_driver_details", { p_order_ids: ids })
        : { data: [], error: null };
      if (driverError) throw driverError;
      const driverByOrder = new Map<string, DriverDetails>();
      await Promise.all((driverRows ?? []).map(async (driver: any) => {
        let photoUrl: string | null = null;
        if (driver.profile_photo_path) {
          const { data: signed } = await supabase.storage.from("driver-documents").createSignedUrl(driver.profile_photo_path, 3600);
          photoUrl = signed?.signedUrl ?? null;
        }
        driverByOrder.set(driver.order_id, { name: driver.driver_name, phone: driver.driver_phone, vehicleType: driver.vehicle_type, plate: driver.vehicle_plate, photoUrl });
      }));
      const nextOrders = rows.map(order => ({
        ...order,
        driver: driverByOrder.get(order.id) ?? null,
        history: (events ?? []).filter((event: any) => event.order_id === order.id),
        deliveryProofUrl: proofResults.find(([id]) => id === order.id)?.[1] ?? null
      }));
      setOrders(nextOrders);
      const freshEvents: OrderEvent[] = [];
      for (const order of nextOrders) {
        const merchantName = one(order.merchants)?.name ?? "Local merchant";
        const address = order.address_snapshot ?? {};
        const base = { orderNumber: order.order_number, merchantName, recipientName: address.recipient_name ?? "Customer", address: [address.address_line, address.landmark].filter(Boolean).join(" · "), total: Number(order.total) };
        for (const event of (order.history ?? []).filter((item: any) => item.to_status === "accepted")) {
          const id = String(event.id);
          const age = Date.now() - new Date(event.created_at).getTime();
          if (!seenOrderEvents.current.has(id) && age >= -60000 && age <= 15 * 60 * 1000) freshEvents.push({ ...base, id, kind: "accepted", createdAt: event.created_at });
          seenOrderEvents.current.add(id);
        }
        if (order.driver_user_id && order.assigned_at) {
          const id = `driver-${order.id}-${order.driver_user_id}`;
          const age = Date.now() - new Date(order.assigned_at).getTime();
          if (!seenOrderEvents.current.has(id) && age >= -60000 && age <= 15 * 60 * 1000) freshEvents.push({ ...base, id, kind: "driver", createdAt: order.assigned_at, driver: order.driver ?? null });
          seenOrderEvents.current.add(id);
        }
      }
      if (freshEvents.length) setOrderEventQueue(current => [...current, ...freshEvents.sort((a, b) => a.createdAt.localeCompare(b.createdAt))]);
    } catch (e: any) { Alert.alert("Unable to load orders", e?.message ?? "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session?.user?.id]);

  useEffect(() => { if (session?.user?.id) void loadMarketplace(); }, [session?.user?.id, loadMarketplace]);
  useEffect(() => { if (tab === "orders" && session?.user?.id) void loadOrders(); }, [tab, session?.user?.id, loadOrders]);
  useEffect(() => {
    if (!activeOrderEvent && orderEventQueue.length) {
      setActiveOrderEvent(orderEventQueue[0]);
      setOrderEventQueue(current => current.slice(1));
    }
  }, [activeOrderEvent, orderEventQueue]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const timer = setInterval(() => {
      if (tab === "market") void loadMarketplace();
      if (tab === "orders") void loadOrders();
    }, 60000);
    return () => clearInterval(timer);
  }, [session?.user?.id, tab, loadMarketplace, loadOrders]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase.channel("customer-orders-" + session.user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "customer_id=eq." + session.user.id }, () => { if (tab === "orders") void loadOrders(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session?.user?.id, tab, loadOrders]);

  const topLevelCategories = categories.filter(c => !c.parent_id);
  const childCategories = categories.filter(c => c.parent_id === selectedParentCategory);
  const activeCategory = categories.find(c => c.slug === selectedCategory);
  const visibleStores = useMemo(() => stores.filter(s =>
    (!selectedCategory || s.categorySlug === selectedCategory) &&
    (!selectedMunicipality || s.municipalityId === selectedMunicipality) &&
    (!search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()) || s.area.toLowerCase().includes(search.trim().toLowerCase()))
  ), [stores, selectedCategory, selectedMunicipality, search]);
  const currentStore = stores.find(s => s.id === selectedStore);
  const managerZones = serviceZones.filter(zone => zone.municipality_id === addressMunicipality);
  const storeProducts = useMemo(() => products.filter(p => p.branch_id === selectedStore && (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))), [products, selectedStore, search]);
  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((n, item) => n + item.quantity, 0);
  // Checkout must use the merchant attached to the selected cart items, not the currently visible store screen.
  const cartMerchant = cartItems[0]?.product.merchant;
  const cartPaymentMethods = Array.isArray(cartMerchant?.accepted_payment_methods) && cartMerchant.accepted_payment_methods.length
    ? cartMerchant.accepted_payment_methods
    : ["cod"];
  const customerUnitPrice = (merchantPrice: number | string) => {
    const base = Number(merchantPrice) || 0;
    if (!merchantUsageSettings.merchant_usage_enabled) return base;
    const rate = Number(merchantUsageSettings.merchant_usage_value) || 0;
    const usage = merchantUsageSettings.merchant_usage_method === "percentage" ? base * rate / 100 : rate;
    return Math.round((base + usage + Number.EPSILON) * 100) / 100;
  };
  const cartTotal = cartItems.reduce((n, item) => n + customerUnitPrice(item.product.price) * item.quantity, 0);

  async function signIn() {
    if (!email.trim() || !password) { Alert.alert("Missing details", "Enter your email and password."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) { Alert.alert("Sign in failed", error.message); setBusy(false); return; }
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      Alert.alert("Email verification required", "Confirm your email using the link sent by SUGOMATE, then sign in again.");
      setBusy(false); return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("phone_verified_at").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile?.phone_verified_at) {
      await supabase.auth.signOut();
      Alert.alert("Mobile verification required", "Complete Philippine mobile SMS verification on sugomate.com/register before signing in.");
      setBusy(false); return;
    }
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (roleError) {
      await supabase.auth.signOut();
      Alert.alert("Unable to verify account type", "Please try again.");
      setBusy(false); return;
    }
    const intended = data.user.user_metadata?.intended_role;
    if (intended === "merchant" || intended === "driver") setApplicationRole(intended);
    else if (!(roleRows ?? []).some((r: any) => r.role === "customer")) {
      await supabase.auth.signOut();
      Alert.alert("Account type not recognized", "Please contact SUGOMATE support.");
    } else setApplicationRole(null);
    setBusy(false);
  }

  async function chooseGcashProof(orderId: string) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        Alert.alert("Unsupported image", "Choose a JPG, PNG or WebP receipt image.");
        return;
      }
      const file = new File(asset.uri);
      const size = asset.fileSize ?? file.size;
      if (!size || size > 5 * 1024 * 1024) {
        Alert.alert("Image too large", "The receipt image must be smaller than 5 MB.");
        return;
      }
      setGcashProof(current => ({ ...current, [orderId]: {
        uri: asset.uri, mimeType,
        fileName: asset.fileName ?? "gcash-receipt." + (mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"),
        size
      }}));
    } catch (e: any) {
      Alert.alert("Unable to select image", e?.message ?? "Please try again.");
    }
  }

  async function submitNativeGcashPayment(order: Order) {
    const reference = (gcashReference[order.id] ?? "").trim();
    const proof = gcashProof[order.id];
    if (!/^[A-Za-z0-9-]{6,40}$/.test(reference)) {
      Alert.alert("Invalid reference", "Enter the 6–40 character GCash transaction reference shown on your receipt.");
      return;
    }
    if (!proof) {
      Alert.alert("Receipt required", "Choose your GCash receipt screenshot before submitting.");
      return;
    }
    if (order.payment_method !== "gcash" || order.payment_status === "paid" ||
        ["cancelled", "rejected", "delivered"].includes(order.status)) {
      Alert.alert("Payment submission unavailable", "This order can no longer accept a GCash payment submission.");
      return;
    }
    setGcashSubmitting(order.id);
    try {
      const extension = proof.mimeType === "image/png" ? "png" : proof.mimeType === "image/webp" ? "webp" : "jpg";
      const fileName = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) + "." + extension;
      const uploadedPath = order.id + "/" + session.user.id + "/" + fileName;
      const bytes = await new File(proof.uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage.from("gcash-payment-proofs").upload(uploadedPath, bytes, {
        contentType: proof.mimeType, cacheControl: "3600", upsert: false
      });
      if (uploadError) throw uploadError;
      const { error: submitError } = await supabase.rpc("customer_submit_gcash_payment", {
        p_order_id: order.id,
        p_transaction_reference: reference,
        p_proof_path: uploadedPath
      });
      if (submitError) throw submitError;
      setGcashProof(current => { const next = { ...current }; delete next[order.id]; return next; });
      setGcashReference(current => ({ ...current, [order.id]: reference }));
      await loadOrders();
      Alert.alert("Payment proof submitted", "The merchant will verify the transaction against their GCash wallet. Your order will not be prepared until the merchant confirms payment.");
    } catch (e: any) {
      Alert.alert("Unable to submit payment proof", e?.message ?? "Please check your connection and try again. If upload completed before the error, the private receipt file may remain unattached to the order.");
    } finally { setGcashSubmitting(null); }
  }

  async function openAddressManager() {
    setAddressManagerBusy(true);
    setAddressManagerOpen(true);
    try {
      const [addressResult, municipalityResult, zoneResult] = await Promise.all([
        supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,landmark,municipality_id,service_zone_id,municipalities(name),service_zones(name)").eq("customer_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
        supabase.from("service_zones").select("id,name,municipality_id").eq("is_active", true).order("name")
      ]);
      if (addressResult.error) throw addressResult.error;
      if (municipalityResult.error) throw municipalityResult.error;
      if (zoneResult.error) throw zoneResult.error;
      setAddresses((addressResult.data ?? []) as unknown as CustomerAddress[]);
      setMunicipalities(municipalityResult.data ?? []);
      setServiceZones((zoneResult.data ?? []) as ServiceZone[]);
    } catch (e: any) {
      setAddressManagerOpen(false);
      Alert.alert("Unable to load saved addresses", e?.message ?? "Please try again.");
    } finally { setAddressManagerBusy(false); }
  }

  async function saveManagedAddress() {
    if (!session?.user?.id || !recipientName.trim() || !recipientPhone.trim() || !addressMunicipality || !addressServiceZone || addressLine.trim().length < 5) {
      Alert.alert("Complete delivery details", "Enter the recipient, mobile number, municipality, barangay/zone and complete street address.");
      return;
    }
    setAddressManagerBusy(true);
    try {
      const { data, error } = await supabase.from("customer_addresses").insert({
        customer_id: session.user.id,
        label: addressLabel.trim().slice(0, 40) || "Home",
        recipient_name: recipientName.trim().slice(0, 120),
        recipient_phone: recipientPhone.trim().slice(0, 40),
        municipality_id: addressMunicipality,
        service_zone_id: addressServiceZone,
        address_line: addressLine.trim().slice(0, 300),
        landmark: addressLandmark.trim().slice(0, 200) || null
      }).select("id,label,recipient_name,recipient_phone,address_line,landmark,municipality_id,service_zone_id,municipalities(name),service_zones(name)").single();
      if (error || !data) throw error ?? new Error("Address was not saved.");
      setAddresses(current => [data as unknown as CustomerAddress, ...current]);
      setAddressLabel("Home"); setRecipientName(""); setRecipientPhone(""); setAddressMunicipality(""); setAddressServiceZone(""); setAddressLine(""); setAddressLandmark("");
      Alert.alert("Address saved", "Your delivery address is now available in the app and at checkout.");
    } catch (e: any) {
      Alert.alert("Unable to save address", e?.message ?? "Please check the details and try again.");
    } finally { setAddressManagerBusy(false); }
  }

  async function signOut() { await supabase.auth.signOut(); setCart({}); setOrders([]); setProducts([]); setStores([]); setGcashProof({}); setGcashReference({}); }
  function addToCart(product: Product) {
    if (cartItems.length && cartItems[0].product.branch_id !== product.branch_id) {
      Alert.alert("One store per order", "Your basket can contain items from one store branch at a time.", [
        { text: "Keep basket", style: "cancel" },
        { text: "Clear and add", onPress: () => setCart({ [product.id]: { product, quantity: 1 } }) }
      ]);
      return;
    }
    setCart(current => ({ ...current, [product.id]: { product, quantity: (current[product.id]?.quantity ?? 0) + 1 } }));
  }
  function changeQuantity(id: string, delta: number) {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[id]?.quantity ?? 0) + delta;
      if (quantity <= 0) delete next[id];
      else if (quantity < 100) next[id] = { ...next[id], quantity };
      return next;
    });
  }
  async function openCheckout() {
    if (!cartItems.length || !session?.user?.id) {
      Alert.alert("Basket unavailable", "Add an item to your basket before continuing.");
      return;
    }
    setCheckoutBusy(true);
    setCheckoutOpen(true);
    setNewAddress(false);
    setCustomerNote("");
    try {
      const [addressResult, feeResult] = await Promise.all([
        supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,landmark,municipality_id,service_zone_id,municipalities(name),service_zones(name)").eq("customer_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("service_zones").select("id,name,municipality_id,base_delivery_fee").eq("is_active", true)
      ]);
      if (addressResult.error) throw addressResult.error;
      const saved = (addressResult.data ?? []) as unknown as CustomerAddress[];
      setAddresses(saved);
      setSelectedAddressId(saved[0]?.id ?? "");
      const feeMap: Record<string, number> = {};
      if (!feeResult.error) {
        const activeZones = (feeResult.data ?? []) as any[];
        setServiceZones(activeZones.map(zone => ({ id: zone.id, name: zone.name, municipality_id: zone.municipality_id })));
        for (const zone of activeZones) feeMap[zone.municipality_id] = Number(zone.base_delivery_fee);
      }
      setDeliveryFees(feeMap);
      setDeliveryFeePreview(saved[0] && feeMap[saved[0].municipality_id] !== undefined ? feeMap[saved[0].municipality_id] : null);
      setPaymentMethod(cartPaymentMethods.includes("cod") ? "cod" : cartPaymentMethods.includes("gcash") ? "gcash" : "cod");
      if (!saved.length) setNewAddress(true);
    } catch (e: any) {
      setCheckoutOpen(false);
      Alert.alert("Unable to open checkout", e?.message ?? "Please try again.");
    } finally { setCheckoutBusy(false); }
  }

  async function placeNativeOrder() {
    if (!cartItems.length || !session?.user?.id) return;
    const methods = cartPaymentMethods;
    if (!methods.includes(paymentMethod)) {
      Alert.alert("Payment method unavailable", "This store does not accept the selected payment method.");
      return;
    }
    if (!newAddress && !selectedAddressId) {
      Alert.alert("Delivery address required", "Choose a saved address or add a new one.");
      return;
    }
    if (newAddress && (!recipientName.trim() || !recipientPhone.trim() || !addressMunicipality || !addressServiceZone || addressLine.trim().length < 5)) {
      Alert.alert("Complete delivery details", "Enter the recipient, mobile number, municipality, barangay/zone, and complete street address.");
      return;
    }
    setCheckoutBusy(true);
    try {
      let addressId = selectedAddressId;
      if (newAddress) {
        const { data: address, error: addressError } = await supabase.from("customer_addresses").insert({
          customer_id: session.user.id,
          label: addressLabel.trim().slice(0, 40) || "Home",
          recipient_name: recipientName.trim().slice(0, 120),
          recipient_phone: recipientPhone.trim().slice(0, 40),
          municipality_id: addressMunicipality,
          service_zone_id: addressServiceZone,
          address_line: addressLine.trim().slice(0, 300),
          landmark: addressLandmark.trim().slice(0, 200) || null
        }).select("id").single();
        if (addressError || !address) throw addressError ?? new Error("Unable to save delivery address.");
        addressId = address.id;
      }
      const safeItems = cartItems.map(item => ({ product_id: item.product.id, quantity: item.quantity }));
      const { data: orderId, error } = await supabase.rpc("place_customer_order", {
        p_address_id: addressId,
        p_items: safeItems,
        p_payment_method: paymentMethod,
        p_customer_note: customerNote.trim().slice(0, 500) || null
      });
      if (error || !orderId) throw error ?? new Error("Order was not created.");
      const { data: order } = await supabase.from("orders")
        .select("id,order_number,subtotal,delivery_fee,total")
        .eq("id", orderId).eq("customer_id", session.user.id).maybeSingle();
      setCart({});
      setCheckoutOpen(false);
      setTab("orders");
      setSelectedStore("");
      await loadOrders();
      Alert.alert("Order placed!", (order?.order_number ?? "Order " + String(orderId).slice(0, 8)) + (order ? "\nTotal: " + peso(order.total) : "") + (paymentMethod === "gcash" ? "\nGCash payment is awaiting your payment proof and merchant verification." : "\nPlease prepare the exact COD amount for the rider."));
    } catch (e: any) {
      Alert.alert("Unable to place order", e?.message ?? "Please refresh your basket and try again.");
    } finally { setCheckoutBusy(false); }
  }

  function showBasket() {
    const lines = cartItems.map(x => x.quantity + " × " + x.product.name + " — " + peso(customerUnitPrice(x.product.price) * x.quantity)).join("\n");
    Alert.alert("Your basket", lines + "\n\nItems subtotal (system usage fee included): " + peso(cartTotal) + "\n\nDelivery fee is calculated at checkout.", [
      { text: "Continue shopping", style: "cancel" },
      { text: "Clear basket", style: "destructive", onPress: () => setCart({}) }
    ]);
  }

  if (checking) return <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>;
  if (session && applicationRole) return <RoleApplicationFlow
    role={applicationRole}
    userId={session.user.id}
    onDone={() => { setApplicationRole(null); supabase.auth.signOut(); }}
    onSignOut={() => { setApplicationRole(null); supabase.auth.signOut(); }}
  />;
  if (!session) return registrationOpen ? <RegistrationFlow onBack={() => setRegistrationOpen(false)} /> : <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}><AndroidStatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[styles.loginWrap, { paddingBottom: Math.max(24, insets.bottom + 18) }]} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center" }}><Image source={BRAND_LOGO} style={styles.loginLogo} resizeMode="contain" /><Text style={styles.tagline}>Imong sugo, kami bahala.</Text></View>
      <View style={styles.loginCard}><Text style={styles.heading}>Welcome to SUGOMATE</Text><Text style={styles.muted}>Your local errands, made simple. Sign in to continue.</Text>
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#8995a7" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8995a7" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={signIn} disabled={busy}>{busy ? <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><ActivityIndicator size="small" color="#fff" /><Text style={styles.primaryText}>Signing in…</Text></View> : <Text style={styles.primaryText}>Sign in</Text>}</TouchableOpacity>
        <View style={styles.signupDivider}><View style={styles.signupRule}/><Text style={styles.signupOr}>NEW TO SUGOMATE?</Text><View style={styles.signupRule}/></View>
        <TouchableOpacity style={styles.signupButton} onPress={() => setRegistrationOpen(true)}><Text style={styles.signupButtonText}>Create an account</Text></TouchableOpacity>
        <Text style={styles.footnote}>Customer, merchant and delivery partner registration are available. Merchant and driver accounts require Admin approval.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;

  const firstName = profileName.split(/\s+/)[0] || "there";
  if (serviceRequestsOpen && session?.user?.id) return <SafeAreaView style={styles.safe}><AndroidStatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false}/><ServiceRequestsScreen userId={session.user.id} initialServiceType={serviceRequestsInitialType} onBack={() => { setServiceRequestsOpen(false); setServiceRequestsInitialType(null); }}/></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><AndroidStatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
    <View style={styles.topbar}>
      <View style={styles.brandRow}><Image source={BRAND_LOGO} style={styles.headerLogo} resizeMode="contain" /><View style={styles.taglineWrap}><Text style={styles.topTag} numberOfLines={1}>Imong sugo, kami bahala.</Text></View></View>
      <TouchableOpacity style={styles.ordersShortcut} onPress={() => setTab("orders")}><Text style={styles.ordersShortcutText}>My Orders</Text></TouchableOpacity>
    </View>
    <View style={styles.greeting}><Text style={styles.greetingSmall}>Maayong adlaw, {firstName}!</Text><Text style={styles.greetingTitle}>Unsa imong sugo karon?</Text></View>
    <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput style={styles.searchInput} placeholder={selectedStore ? "Search this store's items…" : "Search stores or areas…"} placeholderTextColor="#9aa4b3" value={search} onChangeText={setSearch} />{!!search && <TouchableOpacity onPress={() => setSearch("")}><Text style={styles.clearSearch}>×</Text></TouchableOpacity>}</View>
    {tab === "market" && !selectedStore && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaScroll} contentContainerStyle={styles.areaContent}>
      <TouchableOpacity onPress={() => setSelectedMunicipality("")} style={[styles.areaChip, !selectedMunicipality && styles.areaChipActive]}><Text style={[styles.areaChipText, !selectedMunicipality && styles.areaChipTextActive]}>All areas</Text></TouchableOpacity>
      {municipalities.map(m => <TouchableOpacity key={m.id} onPress={() => setSelectedMunicipality(m.id)} style={[styles.areaChip, selectedMunicipality === m.id && styles.areaChipActive]}><Text style={[styles.areaChipText, selectedMunicipality === m.id && styles.areaChipTextActive]}>{m.name}</Text></TouchableOpacity>)}
    </ScrollView>}
    {loading && <ActivityIndicator style={{ marginVertical: 8 }} color={ORANGE} />}
    <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: 16 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (tab === "orders") void loadOrders(); else void loadMarketplace(); }} tintColor={ORANGE} />} >
      {tab === "market" && <>
        {selectedStore && currentStore ? <>
          <TouchableOpacity style={styles.backLink} onPress={() => { setSelectedStore(""); setSearch(""); }}><Text style={styles.backLinkText}>‹  Back to stores</Text></TouchableOpacity>
          <View style={styles.storeHero}>{currentStore.image ? <Image source={{ uri: currentStore.image }} style={styles.storeHeroImage} /> : <Text style={styles.storeHeroIcon}>🏪</Text>}
            <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{currentStore.name}</Text><Text style={styles.muted}>{currentStore.branchName} · {currentStore.area}</Text><Text style={[styles.openLabel, currentStore.isOpen ? styles.open : styles.closed]}>{currentStore.isOpen ? "Open now" : "Closed"}</Text></View></View>
          {currentStore.isOpen ? storeProducts.map(p => <View key={p.id} style={styles.productCard}>
            {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.productImage} resizeMode="contain" /> : <View style={styles.productPlaceholder}><Text style={{ fontSize: 27 }}>🛍️</Text></View>}
            <View style={styles.productInfo}><Text style={styles.productName}>{p.name}</Text><Text style={styles.productDescription} numberOfLines={2}>{p.description ?? ""}</Text><View style={styles.productBottom}><View style={{ gap: 1 }}><Text style={styles.price}>{peso(customerUnitPrice(p.price))}</Text>{merchantUsageSettings.merchant_usage_enabled && <Text style={styles.priceFeeNote}>System usage fee included</Text>}</View><View style={styles.qtyRow}>{cart[p.id] ? <><TouchableOpacity onPress={() => changeQuantity(p.id, -1)} style={styles.qtyButton}><Text style={styles.qtyText}>−</Text></TouchableOpacity><Text style={styles.qtyValue}>{cart[p.id].quantity}</Text><TouchableOpacity onPress={() => changeQuantity(p.id, 1)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></TouchableOpacity></> : <TouchableOpacity onPress={() => addToCart(p)} style={styles.addButton}><Text style={styles.addButtonText}>＋ Add</Text></TouchableOpacity>}</View></View></View>
          </View>) : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🕒</Text><Text style={styles.emptyTitle}>This store is currently closed</Text><Text style={styles.muted}>Please check back during its operating hours.</Text></View>}
          {currentStore.isOpen && storeProducts.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No items available right now</Text><Text style={styles.muted}>Please check back soon.</Text></View>}
        </> : <>
          {!selectedParentCategory && !selectedCategory && <View style={{ marginBottom: 18 }}><Text style={styles.sectionTitle}>Papalit & Pasugo</Text><Text style={styles.sectionSub}>Need something bought or picked up? Send a separate service request.</Text><View style={{ flexDirection: "row", gap: 9 }}><TouchableOpacity onPress={() => { setServiceRequestsInitialType("papalit"); setServiceRequestsOpen(true); }} style={{ flex: 1, backgroundColor: "#102e57", borderRadius: 15, padding: 13 }}><Text style={{ fontSize: 22 }}>🛍️</Text><Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 5 }}>Papalit</Text><Text style={{ color: "#dce7f5", fontSize: 9, marginTop: 3 }}>We buy and deliver</Text></TouchableOpacity><TouchableOpacity onPress={() => { setServiceRequestsInitialType("pasugo"); setServiceRequestsOpen(true); }} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 15, borderWidth: 1, borderColor: "#ffb76a", padding: 13 }}><Text style={{ fontSize: 22 }}>📦</Text><Text style={{ color: "#102e57", fontSize: 13, fontWeight: "900", marginTop: 5 }}>Pasugo</Text><Text style={{ color: "#738096", fontSize: 9, marginTop: 3 }}>We pick up for you</Text></TouchableOpacity></View><TouchableOpacity onPress={() => { setServiceRequestsInitialType(null); setServiceRequestsOpen(true); }} style={{ marginTop: 8, paddingVertical: 9 }}><Text style={{ color: RED, fontSize: 11, fontWeight: "900" }}>My service requests  ›</Text></TouchableOpacity></View>}
          <Text style={styles.sectionTitle}>Browse by category</Text><Text style={styles.sectionSub}>Pick what you need — we'll show you the stores.</Text>
          {selectedParentCategory ? <TouchableOpacity style={styles.backLink} onPress={() => { if (selectedCategory && childCategories.length > 0) setSelectedCategory(""); else { setSelectedCategory(""); setSelectedParentCategory(""); } }}><Text style={styles.backLinkText}>{selectedCategory && childCategories.length > 0 ? "‹  Back to subcategories" : "‹  Back to all categories"}</Text></TouchableOpacity> : null}
          {!selectedParentCategory && <View style={styles.categoryGrid}>{topLevelCategories.map(c => <TouchableOpacity key={c.id} style={styles.categoryCard} onPress={() => { const hasSubcategories = categories.some(child => child.parent_id === c.id); setSelectedParentCategory(c.id); setSelectedCategory(hasSubcategories ? "" : c.slug); }}>
            {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.categoryImage} /> : <View style={styles.categoryFallback}><Text style={styles.categoryEmoji}>{categoryEmoji(c.slug)}</Text></View>}
            <View style={styles.categoryShade} /><View style={styles.categoryCaption}><Text style={styles.categoryName}>{c.name}</Text><Text style={styles.categoryCount}>{visibleStores.filter(s => s.categorySlug === c.slug).length} stores</Text></View>
          </TouchableOpacity>)}</View>}
          {!selectedParentCategory && !selectedCategory && <>
            <View style={styles.storesHeading}><Text style={styles.sectionTitle}>Stores near you</Text><Text style={styles.storeCount}>{visibleStores.length} {visibleStores.length === 1 ? "store" : "stores"}</Text></View>
            {visibleStores.length > 0 ? visibleStores.slice(0, 6).map(s => <TouchableOpacity key={"nearby-" + s.id} style={styles.storeCard} onPress={() => { if (!s.isOpen) { Alert.alert("Store closed", "This store is not accepting orders right now."); return; } setSelectedStore(s.id); setSearch(""); }}>
              {s.image ? <Image source={{ uri: s.image }} style={styles.storeImage} /> : <View style={styles.storeImageFallback}><Text style={{ fontSize: 25 }}>🏪</Text></View>}
              <View style={styles.storeInfo}><Text style={styles.storeName}>{s.name}</Text>{!!s.branchName && <Text style={styles.storeBranch}>{s.branchName}</Text>}<Text style={styles.storeArea}>⌖  {s.area || "Leyte"}</Text><Text style={[styles.openLabel, s.isOpen ? styles.open : styles.closed]}>{s.isOpen ? "Open now" : "Closed"}</Text></View>{s.isOpen ? <Text style={styles.chevron}>›</Text> : <Text style={styles.storeCount}>Unavailable</Text>}
            </TouchableOpacity>) : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛍️</Text><Text style={styles.emptyTitle}>Your local marketplace is getting ready</Text><Text style={styles.muted}>Approved stores will appear here as they join.</Text></View>}
          </>}
          {selectedParentCategory && !selectedCategory && childCategories.length > 0 && <View style={styles.categoryGrid}>{childCategories.map(c => <TouchableOpacity key={c.id} style={styles.categoryCard} onPress={() => setSelectedCategory(c.slug)}>
            {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.categoryImage} /> : <View style={styles.categoryFallback}><Text style={styles.categoryEmoji}>{categoryEmoji(c.slug)}</Text></View>}
            <View style={styles.categoryShade} /><View style={styles.categoryCaption}><Text style={styles.categoryName}>{c.name}</Text><Text style={styles.categoryCount}>{stores.filter(s => s.categorySlug === c.slug).length} stores</Text></View>
          </TouchableOpacity>)}</View>}
          {selectedParentCategory && !selectedCategory && childCategories.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No subcategories available</Text><Text style={styles.muted}>Please check back soon.</Text></View>}
          {selectedCategory && <><View style={styles.storesHeading}><Text style={styles.sectionTitle}>{activeCategory?.name ?? "Stores"}</Text><Text style={styles.storeCount}>{visibleStores.length} {visibleStores.length === 1 ? "store" : "stores"}</Text></View>
          {visibleStores.map(s => <TouchableOpacity key={s.id} style={styles.storeCard} onPress={() => { if (!s.isOpen) { Alert.alert("Store closed", "This store is not accepting orders right now."); return; } setSelectedStore(s.id); setSearch(""); }}>
            {s.image ? <Image source={{ uri: s.image }} style={styles.storeImage} /> : <View style={styles.storeImageFallback}><Text style={{ fontSize: 25 }}>🏪</Text></View>}
            <View style={styles.storeInfo}><Text style={styles.storeName}>{s.name}</Text>{!!s.branchName && <Text style={styles.storeBranch}>{s.branchName}</Text>}<Text style={styles.storeArea}>⌖  {s.area || "Leyte"}</Text><Text style={[styles.openLabel, s.isOpen ? styles.open : styles.closed]}>{s.isOpen ? "Open now" : "Closed"}</Text></View><Text style={styles.chevron}>›</Text>
          </TouchableOpacity>)}
          {visibleStores.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛍️</Text><Text style={styles.emptyTitle}>No stores found</Text><Text style={styles.muted}>Try another category, search, or service area.</Text></View>}</>}
        </>}
      </>}
      {tab === "orders" && <>
        <Text style={styles.sectionTitle}>My orders</Text><Text style={styles.sectionSub}>Follow your orders from store confirmation through delivery.</Text>
        {orders.map(o => {
          const merchant = one(o.merchants);
          const isTerminal = ["cancelled", "rejected", "delivered"].includes(o.status);
          const submitted = Boolean(o.gcash_payment_submitted_at) && o.payment_status !== "failed";
          return <View key={o.id} style={styles.orderCard}>
            <View style={styles.orderTop}><View><Text style={styles.orderNumber}>{o.order_number}</Text><Text style={styles.storeName}>{merchant?.name ?? "Local merchant"}</Text><Text style={styles.storeBranch}>{new Date(o.placed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</Text></View><Text style={styles.statusPill}>{orderStatus[o.status] ?? o.status.replaceAll("_", " ")}</Text></View>
            <OrderProgressTracker status={o.status} />
            <View style={styles.orderAmounts}><View style={styles.amountRow}><Text style={styles.amountLabel}>Items subtotal</Text><Text style={styles.amountValue}>{peso(o.subtotal)}</Text></View><View style={styles.amountRow}><Text style={styles.deliveryLabel}>Delivery fee</Text><Text style={styles.deliveryValue}>{peso(o.delivery_fee)}</Text></View><View style={[styles.amountRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{peso(o.total)}</Text></View></View>
            {Boolean(o.order_items?.length) && <View style={styles.orderItems}><Text style={styles.orderDetailTitle}>Items ordered</Text>{o.order_items?.map((item: any) => <View key={item.id} style={styles.orderItemRow}><Text style={styles.orderItemName}>{item.quantity} × {item.product_name}</Text><Text style={styles.orderItemPrice}>{peso(item.line_total)}</Text></View>)}</View>}
            {o.status === "accepted" && <View style={[styles.riderNotice, o.rider_on_way_at ? styles.riderNoticeReady : null]}><Text style={styles.riderNoticeText}>{o.rider_on_way_at ? "Your rider confirmed and is heading to the store. The merchant can now start preparing." : "The store reserved your items and is waiting for a rider to commit. Preparation starts after the rider confirms they are on the way."}</Text></View>}
            {o.driver && <View style={styles.driverCard}>
              <Text style={styles.driverCardTitle}>Your delivery partner</Text>
              <View style={styles.driverCardRow}>
                {o.driver.photoUrl ? <Image source={{ uri: o.driver.photoUrl }} style={styles.driverPhoto} /> : <View style={styles.driverPhotoFallback}><Text style={{ fontSize: 25 }}>🛵</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{o.driver.name || "Delivery partner"}</Text>
                  <Text style={styles.driverMeta}>{o.driver.vehicleType || "Motorcycle"}{o.driver.plate ? " · " + o.driver.plate : ""}</Text>
                  {!!o.driver.phone && <TouchableOpacity onPress={() => Linking.openURL("tel:" + o.driver?.phone)}><Text style={styles.driverPhone}>☎  {o.driver.phone}</Text></TouchableOpacity>}
                </View>
              </View>
            </View>}
            <View style={styles.paymentSummary}><Text style={styles.paymentSummaryText}>Payment: {String(o.payment_method).toUpperCase()} · {String(o.payment_status).replaceAll("_", " ")}</Text></View>
            {Boolean(o.history?.length) && <View style={styles.orderHistory}><Text style={styles.orderDetailTitle}>Order activity</Text>{o.history?.map((event: any, index: number) => <View key={event.id} style={styles.historyRow}><View style={styles.historyMarker}><View style={[styles.historyDot, index === (o.history?.length ?? 0) - 1 && styles.historyDotActive]}/>{index !== (o.history?.length ?? 0) - 1 && <View style={styles.historyLine}/>}</View><View style={styles.historyBody}><Text style={styles.historyStatus}>{orderStatus[event.to_status] ?? String(event.to_status).replaceAll("_", " ")}</Text><Text style={styles.historyDate}>{new Date(event.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</Text>{event.note && <Text style={styles.historyNote}>{event.note}</Text>}</View></View>)}</View>}
            {o.deliveryProofUrl && <TouchableOpacity style={styles.deliveryProofButton} onPress={() => Linking.openURL(o.deliveryProofUrl as string)}><Text style={styles.deliveryProofText}>View delivery photo ↗</Text></TouchableOpacity>}
            {o.driver_note && <Text style={styles.driverNote}>Driver note: {o.driver_note}</Text>}
            {o.payment_method === "gcash" && !isTerminal && <View style={styles.gcashCard}>
              <View style={styles.gcashHeader}><Text style={styles.gcashTitle}>Pay with GCash</Text><Text style={styles.gcashBadge}>{o.payment_status === "paid" ? "Verified" : submitted ? "Verification pending" : "Payment needed"}</Text></View>
              {o.payment_status === "paid" ? <Text style={styles.gcashSuccess}>✓ Payment confirmed by the merchant. Your order can proceed through the normal fulfillment workflow.</Text> : <>
                <Text style={styles.gcashHint}>Pay the exact order total, including the delivery fee. The merchant must verify the transaction against their GCash wallet before preparing your order.</Text>
                <View style={styles.gcashAmount}><Text style={styles.gcashHint}>Amount to pay</Text><Text style={styles.gcashTotal}>{peso(o.total)}</Text></View>
                {merchant?.gcash_payment_type === "qr" && merchant?.gcash_qr_url ? <View style={styles.gcashQrWrap}><Image source={{ uri: merchant.gcash_qr_url }} style={styles.gcashQr} resizeMode="contain"/><Text style={styles.gcashHint}>Scan the merchant's QR code in GCash. If you are using the same phone, save the QR image first if your GCash app cannot scan from the screen.</Text></View> : <View style={styles.gcashAccount}><Text style={styles.gcashHint}>GCash account name</Text><Text style={styles.gcashAccountValue}>{merchant?.gcash_account_name ?? "Not provided"}</Text><Text style={[styles.gcashHint, { marginTop: 9 }]}>GCash mobile number</Text><Text style={styles.gcashPhone}>{merchant?.gcash_mobile_number ?? "Not provided"}</Text></View>}
                {submitted ? <View style={styles.gcashPending}><Text style={styles.gcashPendingTitle}>Receipt submitted · Waiting for merchant verification</Text><Text style={styles.gcashHint}>Reference: {o.gcash_payment_reference ?? "Not available"}</Text><Text style={styles.gcashHint}>The merchant will verify your payment. Do not pay again unless the merchant or support team asks you to.</Text></View> : <View style={styles.gcashForm}>
                  <Text style={styles.gcashLabel}>GCash transaction reference</Text>
                  <TextInput style={styles.gcashInput} placeholder="6–40 characters from your receipt" autoCapitalize="characters" value={gcashReference[o.id] ?? ""} onChangeText={value => setGcashReference(current => ({ ...current, [o.id]: value }))} maxLength={40}/>
                  <Text style={styles.gcashLabel}>Receipt screenshot</Text>
                  <TouchableOpacity style={styles.gcashPick} onPress={() => void chooseGcashProof(o.id)}><Text style={styles.gcashPickText}>{gcashProof[o.id] ? "Change selected receipt" : "Choose receipt image"}</Text></TouchableOpacity>
                  {gcashProof[o.id] && <View style={styles.gcashPreviewWrap}><Image source={{ uri: gcashProof[o.id].uri }} style={styles.gcashPreview} resizeMode="cover"/><View style={{ flex: 1 }}><Text style={styles.gcashPreviewName} numberOfLines={2}>{gcashProof[o.id].fileName}</Text><Text style={styles.gcashHint}>{(gcashProof[o.id].size / 1024 / 1024).toFixed(2)} MB · {gcashProof[o.id].mimeType}</Text><TouchableOpacity onPress={() => setGcashProof(current => { const next = { ...current }; delete next[o.id]; return next; })}><Text style={styles.gcashRemove}>Remove image</Text></TouchableOpacity></View></View>}
                  <Text style={styles.gcashHint}>JPG, PNG or WebP · Maximum 5 MB. Never share your GCash MPIN, password or OTP.</Text>
                  <TouchableOpacity disabled={gcashSubmitting === o.id} style={[styles.gcashSubmit, gcashSubmitting === o.id && styles.disabled]} onPress={() => void submitNativeGcashPayment(o)}><Text style={styles.gcashSubmitText}>{gcashSubmitting === o.id ? "Submitting receipt…" : "Submit payment proof"}</Text></TouchableOpacity>
                </View>}
              </>}
            </View>}
          </View>;
        })}
        {!loading && orders.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛵</Text><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Your placed orders will appear here.</Text><TouchableOpacity onPress={() => setTab("market")} style={styles.primary}><Text style={styles.primaryText}>Browse marketplace</Text></TouchableOpacity></View>}
      </>}
      {tab === "account" && <View style={styles.accountCard}><Text style={styles.sectionTitle}>Your account</Text><Text style={styles.muted}>{session.user.email}</Text><TouchableOpacity style={styles.accountLink} onPress={() => void openAddressManager()}><Text style={styles.accountLinkText}>Manage saved addresses  ›</Text></TouchableOpacity><TouchableOpacity style={styles.accountLink} onPress={() => setTab("orders")}><Text style={styles.accountLinkText}>My orders  ›</Text></TouchableOpacity><TouchableOpacity style={styles.accountLink} onPress={() => { setServiceRequestsInitialType(null); setServiceRequestsOpen(true); }}><Text style={styles.accountLinkText}>Papalit & Pasugo requests  ›</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, { marginTop: 22 }]} onPress={signOut}><Text style={styles.primaryText}>Sign out</Text></TouchableOpacity></View>}
    </ScrollView>
    {tab === "market" && cartCount > 0 && (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={cartCount + " items in basket. View basket and checkout"}
        activeOpacity={0.82}
        style={styles.basketCollapsedBar}
        onPress={() => void openCheckout()}
      >
        <View style={styles.basketCollapsedIconWrap}>
          <Text style={styles.basketCollapsedIcon}>🛒</Text>
          <View style={styles.basketCountBadge}><Text style={styles.basketCountBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.basketCollapsedTitle}>{cartCount} {cartCount === 1 ? "item" : "items"} · View basket</Text>
          <Text style={styles.basketCollapsedSubtitle}>Tap to review items and checkout</Text>
        </View>
        <Text style={styles.basketCollapsedTotal}>{peso(cartTotal)}</Text>
        <Text style={styles.basketCollapsedChevron}>›</Text>
      </TouchableOpacity>
    )}
    <Modal visible={Boolean(activeOrderEvent)} transparent animationType="fade" onRequestClose={() => setActiveOrderEvent(null)}>
      {activeOrderEvent && <View style={styles.eventOverlay}>
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventIcon}>{activeOrderEvent.kind === "driver" ? "🛵" : "🏪"}</Text>
            <Text style={styles.eventTitle}>{activeOrderEvent.kind === "driver" ? "Delivery partner found!" : "Your order is accepted!"}</Text>
            <Text style={styles.eventSubtitle}>{activeOrderEvent.kind === "driver" ? "A delivery partner has claimed your order." : "The store confirmed your order and reserved your items."}</Text>
          </View>
          <View style={styles.eventDetails}>
            <Text style={styles.eventLabel}>ORDER DETAILS · {activeOrderEvent.orderNumber}</Text>
            <Text style={styles.eventMerchant}>{activeOrderEvent.merchantName}</Text>
            <Text style={styles.eventMeta}>{activeOrderEvent.recipientName}</Text>
            <Text style={styles.eventMeta}>{activeOrderEvent.address || "Delivery address on your order"}</Text>
            <View style={styles.eventTotal}><Text style={styles.eventMeta}>Order total</Text><Text style={styles.eventTotalValue}>{peso(activeOrderEvent.total)}</Text></View>
          </View>
          {activeOrderEvent.kind === "driver" && <View style={styles.eventDriver}>
            <Text style={styles.eventLabel}>YOUR DELIVERY PARTNER</Text>
            <View style={styles.driverCardRow}>
              {activeOrderEvent.driver?.photoUrl ? <Image source={{ uri: activeOrderEvent.driver.photoUrl }} style={styles.driverPhoto} /> : <View style={styles.driverPhotoFallback}><Text style={{ fontSize: 25 }}>🛵</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{activeOrderEvent.driver?.name || "Delivery partner"}</Text>
                <Text style={styles.driverMeta}>{activeOrderEvent.driver?.vehicleType || "Motorcycle"}{activeOrderEvent.driver?.plate ? " · " + activeOrderEvent.driver.plate : ""}</Text>
                {!!activeOrderEvent.driver?.phone && <TouchableOpacity onPress={() => Linking.openURL("tel:" + activeOrderEvent.driver?.phone)}><Text style={styles.driverPhone}>☎  {activeOrderEvent.driver.phone}</Text></TouchableOpacity>}
              </View>
            </View>
            <Text style={styles.eventVerified}>✓ Registered delivery partner assigned</Text>
          </View>}
          <TouchableOpacity style={styles.eventButton} onPress={() => setActiveOrderEvent(null)}><Text style={styles.eventButtonText}>OK, Got it</Text></TouchableOpacity>
        </View>
      </View>}
    </Modal>
    <Modal visible={addressManagerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!addressManagerBusy) setAddressManagerOpen(false); }}>
      <SafeAreaView style={styles.checkoutSafe}>
        <ScrollView contentContainerStyle={styles.checkoutContent} keyboardShouldPersistTaps="handled">
          <View style={styles.checkoutHeader}><TouchableOpacity disabled={addressManagerBusy} onPress={() => setAddressManagerOpen(false)}><Text style={styles.backLinkText}>‹  Back</Text></TouchableOpacity><Text style={styles.checkoutTitle}>Saved addresses</Text></View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutSection}>Add a delivery address</Text>
            <Text style={styles.checkoutHint}>Saved securely to your customer account. You will stay signed in.</Text>
            <TextInput style={styles.checkoutInput} placeholder="Address label (Home, Work)" value={addressLabel} onChangeText={setAddressLabel}/>
            <TextInput style={styles.checkoutInput} placeholder="Recipient full name" value={recipientName} onChangeText={setRecipientName}/>
            <TextInput style={styles.checkoutInput} placeholder="Mobile number" keyboardType="phone-pad" value={recipientPhone} onChangeText={setRecipientPhone}/>
            <Text style={styles.checkoutHint}>Select municipality</Text>
            {municipalities.map(m => <TouchableOpacity key={m.id} onPress={() => { setAddressMunicipality(m.id); setAddressServiceZone(""); }} style={[styles.municipalityOption, addressMunicipality === m.id && styles.addressOptionActive]}><Text style={styles.addressOptionText}>{addressMunicipality === m.id ? "● " : "○ "}{m.name}</Text></TouchableOpacity>)}
            <Text style={styles.checkoutHint}>Select barangay / service zone</Text>
            {managerZones.map(zone => <TouchableOpacity key={zone.id} onPress={() => setAddressServiceZone(zone.id)} style={[styles.municipalityOption, addressServiceZone === zone.id && styles.addressOptionActive]}><Text style={styles.addressOptionText}>{addressServiceZone === zone.id ? "● " : "○ "}{zone.name}</Text></TouchableOpacity>)}
            {!!addressMunicipality && managerZones.length === 0 && <Text style={styles.checkoutHint}>No active delivery zones are configured for this municipality.</Text>}
            <TextInput style={[styles.checkoutInput, styles.checkoutMultiline]} placeholder="House no., street, purok / sitio, barangay" multiline value={addressLine} onChangeText={setAddressLine}/>
            <TextInput style={styles.checkoutInput} placeholder="Nearby landmark (optional)" value={addressLandmark} onChangeText={setAddressLandmark}/>
            <TouchableOpacity disabled={addressManagerBusy} style={[styles.primary, addressManagerBusy && styles.disabled]} onPress={() => void saveManagedAddress()}><Text style={styles.primaryText}>{addressManagerBusy ? "Saving…" : "Save address"}</Text></TouchableOpacity>
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutSection}>Your saved addresses ({addresses.length})</Text>
            {addressManagerBusy && addresses.length === 0 ? <ActivityIndicator color={ORANGE}/> : addresses.length ? addresses.map(a => <View key={a.id} style={styles.addressOption}>
              <Text style={styles.addressOptionTitle}>{a.label} · {a.recipient_name}</Text>
              <Text style={styles.addressOptionText}>{a.address_line}</Text>
              <Text style={styles.addressOptionText}>{one(a.service_zones)?.name ?? "Service zone"} · {one(a.municipalities)?.name ?? ""}</Text>
              <Text style={styles.addressOptionText}>{a.recipient_phone}{a.landmark ? " · Near " + a.landmark : ""}</Text>
            </View>) : <Text style={styles.checkoutHint}>No saved addresses yet. Add one above.</Text>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <Modal visible={checkoutOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!checkoutBusy) setCheckoutOpen(false); }}>
      <SafeAreaView style={styles.checkoutSafe}>
        <ScrollView contentContainerStyle={styles.checkoutContent} keyboardShouldPersistTaps="handled">
          <View style={styles.checkoutHeader}><TouchableOpacity disabled={checkoutBusy} onPress={() => setCheckoutOpen(false)}><Text style={styles.backLinkText}>‹  Back</Text></TouchableOpacity><Text style={styles.checkoutTitle}>Checkout</Text></View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutSection}>Delivery address</Text>
            {!newAddress && addresses.map(a => <TouchableOpacity key={a.id} style={[styles.addressOption, selectedAddressId === a.id && styles.addressOptionActive]} onPress={() => { setSelectedAddressId(a.id); setDeliveryFeePreview(deliveryFees[a.municipality_id] ?? null); }}>
              <Text style={styles.addressOptionTitle}>{selectedAddressId === a.id ? "● " : "○ "}{a.label} · {a.recipient_name}</Text>
              <Text style={styles.addressOptionText}>{a.address_line}, {one(a.municipalities)?.name ?? ""}</Text>
              <Text style={styles.addressOptionText}>{a.recipient_phone}{a.landmark ? " · Near " + a.landmark : ""}</Text>
            </TouchableOpacity>)}
            <TouchableOpacity onPress={() => { setNewAddress(v => { const next = !v; if (next) setDeliveryFeePreview(null); else { const selected = addresses.find(a => a.id === selectedAddressId); setDeliveryFeePreview(selected ? deliveryFees[selected.municipality_id] ?? null : null); } return next; }); }} style={styles.addressToggle}><Text style={styles.addressToggleText}>{newAddress ? "Choose a saved address" : "+ Add a new delivery address"}</Text></TouchableOpacity>
            {newAddress && <>
              <TextInput style={styles.checkoutInput} placeholder="Address label (Home, Work)" value={addressLabel} onChangeText={setAddressLabel}/>
              <TextInput style={styles.checkoutInput} placeholder="Recipient full name" value={recipientName} onChangeText={setRecipientName}/>
              <TextInput style={styles.checkoutInput} placeholder="Mobile number" keyboardType="phone-pad" value={recipientPhone} onChangeText={setRecipientPhone}/>
              <Text style={styles.checkoutHint}>Select municipality</Text>
              {municipalities.map(m => <TouchableOpacity key={m.id} onPress={() => { setAddressMunicipality(m.id); setAddressServiceZone(""); setDeliveryFeePreview(deliveryFees[m.id] ?? null); }} style={[styles.municipalityOption, addressMunicipality === m.id && styles.addressOptionActive]}><Text style={styles.addressOptionText}>{addressMunicipality === m.id ? "● " : "○ "}{m.name}</Text></TouchableOpacity>)}
              <Text style={styles.checkoutHint}>Select barangay / service zone</Text>
              {serviceZones.filter(zone => zone.municipality_id === addressMunicipality).map(zone => <TouchableOpacity key={zone.id} onPress={() => setAddressServiceZone(zone.id)} style={[styles.municipalityOption, addressServiceZone === zone.id && styles.addressOptionActive]}><Text style={styles.addressOptionText}>{addressServiceZone === zone.id ? "● " : "○ "}{zone.name}</Text></TouchableOpacity>)}
              {!!addressMunicipality && managerZones.length === 0 && serviceZones.filter(zone => zone.municipality_id === addressMunicipality).length === 0 && <Text style={styles.checkoutHint}>No active delivery zones are configured for this municipality. Please choose another area.</Text>}
              <TextInput style={[styles.checkoutInput, styles.checkoutMultiline]} placeholder="House no., street, purok / sitio, barangay" multiline value={addressLine} onChangeText={setAddressLine}/>
              <TextInput style={styles.checkoutInput} placeholder="Nearby landmark (optional)" value={addressLandmark} onChangeText={setAddressLandmark}/>
            </>}
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutSection}>Order summary</Text>
            {cartItems.map(item => <View key={item.product.id} style={styles.checkoutAmountRow}><Text style={styles.checkoutAmountLabel}>{item.quantity} × {item.product.name}</Text><Text style={styles.checkoutAmountValue}>{peso(customerUnitPrice(item.product.price) * item.quantity)}</Text></View>)}
            <View style={styles.checkoutAmountRow}><Text style={styles.checkoutAmountLabel}>Items subtotal</Text><Text style={styles.checkoutAmountValue}>{peso(cartTotal)}</Text></View>
            <View style={styles.checkoutAmountRow}><Text style={styles.checkoutDeliveryLabel}>Delivery fee</Text><Text style={styles.checkoutDeliveryLabel}>{deliveryFeePreview === null ? "Calculated at checkout" : peso(deliveryFeePreview)}</Text></View>
            <View style={[styles.checkoutAmountRow, styles.checkoutTotalRow]}><Text style={styles.checkoutTotalLabel}>Estimated total</Text><Text style={styles.checkoutTotalLabel}>{deliveryFeePreview === null ? "Confirmed after placement" : peso(cartTotal + deliveryFeePreview)}</Text></View>
            <Text style={styles.checkoutHint}>Displayed item prices include the applicable system usage fee. Final prices, stock, delivery fee and total are validated securely when you place the order.</Text>
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutSection}>Payment method</Text>
            {cartPaymentMethods.includes("cod") && <TouchableOpacity style={[styles.paymentOption, paymentMethod === "cod" && styles.addressOptionActive]} onPress={() => setPaymentMethod("cod")}><Text style={styles.paymentTitle}>{paymentMethod === "cod" ? "● " : "○ "}Cash on Delivery (COD)</Text><Text style={styles.checkoutHint}>Pay the displayed order total in cash on delivery. Rider cash capacity and assignment safeguards are handled in the order workflow.</Text></TouchableOpacity>}
            {cartPaymentMethods.includes("gcash") && <TouchableOpacity style={[styles.paymentOption, paymentMethod === "gcash" && styles.addressOptionActive]} onPress={() => setPaymentMethod("gcash")}><Text style={styles.paymentTitle}>{paymentMethod === "gcash" ? "● " : "○ "}GCash</Text><Text style={styles.checkoutHint}>Pay the full order total, including the delivery fee. Merchant confirmation is required before preparation.</Text></TouchableOpacity>}
            <TextInput style={[styles.checkoutInput, styles.checkoutMultiline]} placeholder="Delivery instructions (optional)" multiline value={customerNote} onChangeText={setCustomerNote}/>
          </View>
          <TouchableOpacity disabled={checkoutBusy || !cartItems.length} style={[styles.primary, checkoutBusy && styles.disabled]} onPress={placeNativeOrder}><Text style={styles.primaryText}>{checkoutBusy ? "Placing order…" : deliveryFeePreview === null ? "Place order · Confirm total at placement" : "Place order · " + peso(cartTotal + deliveryFeePreview)}</Text></TouchableOpacity>
          <Text style={styles.checkoutFootnote}>For GCash, your order stays unprepared until the merchant verifies payment in their GCash wallet. Do not treat an uploaded receipt as payment confirmation.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <View style={[styles.tabbar, { paddingBottom: Math.max(8, insets.bottom + 6) }]}>{(["market", "orders", "account"] as Tab[]).map(t => <TouchableOpacity key={t} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={t === "market" ? "Marketplace" : t === "orders" ? "My Orders" : "More menu"} onPress={() => { setTab(t); if (t !== "market") setSelectedStore(""); }} style={[styles.tab, tab === t && styles.activeTab]}><Text style={[styles.tabIcon, tab === t && styles.activeTabText]}>{t === "market" ? "⌂" : t === "orders" ? "▤" : "☰"}</Text><Text style={[styles.tabText, tab === t && styles.activeTabText]}>{t === "market" ? "Marketplace" : t === "orders" ? "My Orders" : "More"}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG },
  loginWrap: { flexGrow: 1, justifyContent: "center", padding: 24 }, loginLogo: { alignSelf: "center", width: 260, height: 126, marginBottom: 8 }, headerLogo: { width: 116, height: 42, flexShrink: 0 }, tagline: { textAlign: "center", color: RED, marginTop: 4, fontWeight: "700" },
  loginCard: { marginTop: 34, padding: 22, borderRadius: 26, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ffead8" }, heading: { fontSize: 24, fontWeight: "900", color: NAVY }, muted: { fontSize: 12, color: "#738096", marginTop: 5, lineHeight: 18 },
  input: { marginTop: 16, paddingHorizontal: 15, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e5eaf0", fontSize: 15, color: NAVY, backgroundColor: "#fff" },
  primary: { marginTop: 18, backgroundColor: ORANGE, padding: 14, borderRadius: 15, alignItems: "center" }, disabled: { opacity: .6 }, primaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  linkButton: { alignItems: "center", padding: 15 }, link: { color: RED, fontWeight: "800" }, signupDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 }, signupRule: { flex: 1, height: 1, backgroundColor: "#edf0f3" }, signupOr: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: "#8995a7" }, signupButton: { marginTop: 13, paddingVertical: 13, borderRadius: 15, alignItems: "center", borderWidth: 1.5, borderColor: NAVY, backgroundColor: "#fff" }, signupButtonText: { color: NAVY, fontWeight: "900", fontSize: 13 }, footnote: { fontSize: 11, color: "#8995a7", lineHeight: 17, textAlign: "center" },
  topbar: { paddingHorizontal: 16, paddingVertical: 11, minHeight: 64, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff" }, brandRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 }, taglineWrap: { flex: 1, minWidth: 0 },
  smallMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }, smallMarkText: { fontSize: 22, fontWeight: "900", color: ORANGE },
  topTag: { flexShrink: 1, fontSize: 9, color: RED, marginTop: 1 }, ordersShortcut: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#ffead8" }, ordersShortcutText: { fontSize: 11, fontWeight: "800", color: NAVY },
  greeting: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 13 }, greetingSmall: { fontSize: 12, fontWeight: "800", color: RED }, greetingTitle: { fontSize: 21, fontWeight: "900", color: NAVY, marginTop: 4 },
  searchWrap: { marginHorizontal: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ffead8", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }, searchIcon: { fontSize: 23, color: "#9aa4b3" }, searchInput: { flex: 1, height: 44, fontSize: 13, color: NAVY, paddingHorizontal: 8 }, clearSearch: { fontSize: 22, color: "#8995a7", paddingHorizontal: 5 },
  areaScroll: { maxHeight: 48, marginTop: 8, flexGrow: 0 }, areaContent: { paddingHorizontal: 14, alignItems: "center", gap: 7 }, areaChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e9e3dc" }, areaChipActive: { backgroundColor: NAVY, borderColor: NAVY }, areaChipText: { fontSize: 10, fontWeight: "700", color: NAVY }, areaChipTextActive: { color: "#fff" },
  content: { flex: 1 }, contentInner: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 105 }, sectionTitle: { fontSize: 18, fontWeight: "900", color: NAVY }, sectionSub: { fontSize: 11, color: "#738096", marginTop: 3, marginBottom: 13 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 }, categoryCard: { width: "48%", height: 145, borderRadius: 18, overflow: "hidden", backgroundColor: NAVY, borderWidth: 2, borderColor: "transparent" }, categoryCardSelected: { borderColor: ORANGE, transform: [{ scale: 0.985 }] }, categoryImage: { width: "100%", height: "100%", position: "absolute" }, categoryFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#294d75" }, categoryEmoji: { fontSize: 42 }, categoryShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,23,46,0.32)" }, categoryCaption: { position: "absolute", bottom: 11, left: 11, right: 8 }, categoryName: { fontSize: 13, fontWeight: "900", color: "#fff" }, categoryCount: { fontSize: 10, fontWeight: "700", color: "#fff", marginTop: 3 },
  storesHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 10 }, storeCount: { fontSize: 10, color: "#8995a7", fontWeight: "700" },
  storeCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", padding: 11, marginBottom: 9, gap: 11 }, storeImage: { width: 66, height: 66, borderRadius: 14, resizeMode: "contain", backgroundColor: "#fff7ef" }, storeImageFallback: { width: 66, height: 66, borderRadius: 14, backgroundColor: "#fff0df", alignItems: "center", justifyContent: "center" }, storeInfo: { flex: 1 }, storeName: { fontSize: 13, fontWeight: "900", color: NAVY }, storeBranch: { fontSize: 10, color: "#8995a7", marginTop: 3 }, storeArea: { fontSize: 10, color: "#8995a7", marginTop: 4 }, openLabel: { fontSize: 9, fontWeight: "800", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginTop: 5 }, open: { backgroundColor: "#e7f7ed", color: "#177245" }, closed: { backgroundColor: "#f1f2f4", color: "#697586" }, chevron: { fontSize: 25, color: "#c1c9d2", paddingHorizontal: 5 },
  backLink: { marginBottom: 12 }, backLinkText: { fontSize: 12, fontWeight: "800", color: RED }, storeHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: "#fff", marginBottom: 13, borderWidth: 1, borderColor: "#ffead8" }, storeHeroImage: { width: 62, height: 62, borderRadius: 14, resizeMode: "contain" }, storeHeroIcon: { fontSize: 40, width: 62, textAlign: "center" },
  productCard: { flexDirection: "row", padding: 10, backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", marginBottom: 10, gap: 10 }, productImage: { width: 104, height: 112, borderRadius: 13, backgroundColor: "#fff7ef" }, productPlaceholder: { width: 104, height: 112, borderRadius: 13, backgroundColor: "#fff0df", alignItems: "center", justifyContent: "center" }, productInfo: { flex: 1, justifyContent: "space-between", paddingVertical: 3 }, productName: { fontSize: 13, fontWeight: "900", color: NAVY }, productDescription: { fontSize: 10, color: "#8995a7", marginTop: 4 }, productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5, marginTop: 7 }, price: { fontSize: 14, fontWeight: "900", color: RED }, qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 }, qtyButton: { width: 27, height: 27, borderRadius: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }, qtyText: { fontSize: 17, color: "#fff", fontWeight: "900" }, qtyValue: { fontSize: 12, fontWeight: "900", color: NAVY }, addButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: NAVY }, addButtonText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  emptyCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#ffead8", padding: 25, marginTop: 10 }, emptyIcon: { fontSize: 34 }, emptyTitle: { fontSize: 14, fontWeight: "900", color: NAVY, marginTop: 8 },
  basketBar: { marginHorizontal: 15, marginTop: 8, marginBottom: 8, backgroundColor: ORANGE, borderRadius: 25, paddingLeft: 18, paddingRight: 8, paddingVertical: 7, minHeight: 58, flexDirection: "row", alignItems: "center", elevation: 5 }, basketMain: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, basketText: { fontSize: 12, fontWeight: "900", color: "#fff" }, basketSubtext: { fontSize: 9, color: "#fff7e8", marginTop: 3 }, basketTotal: { fontSize: 13, fontWeight: "900", color: "#fff" }, basketCollapse: { width: 38, height: 42, marginLeft: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }, basketCollapseText: { color: "#fff", fontSize: 25, fontWeight: "900", lineHeight: 27 }, basketCollapsedBar: { alignSelf: "stretch", marginHorizontal: 15, marginTop: 8, marginBottom: 8, minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 28, backgroundColor: "#fff", borderWidth: 1.5, borderColor: ORANGE, elevation: 5 }, basketCollapsedIconWrap: { width: 34, height: 34, borderRadius: 18, backgroundColor: "#fff0df", alignItems: "center", justifyContent: "center" }, basketCollapsedIcon: { fontSize: 18 }, basketCountBadge: { position: "absolute", top: -5, right: -7, minWidth: 18, height: 18, borderRadius: 10, paddingHorizontal: 4, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }, basketCountBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" }, basketCollapsedTitle: { color: NAVY, fontSize: 11, fontWeight: "900" }, basketCollapsedSubtitle: { color: RED, fontSize: 8, fontWeight: "700", marginTop: 2 }, basketCollapsedTotal: { color: NAVY, fontSize: 12, fontWeight: "900" }, basketCollapsedChevron: { color: "#9aa4b3", fontSize: 25, fontWeight: "700", marginLeft: 1 },
  tabbar: { minHeight: 66, marginBottom: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0e3d9", flexDirection: "row", alignItems: "center", paddingHorizontal: 9, paddingTop: 7, paddingBottom: 8, gap: 8 }, tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "#e4e8ee", backgroundColor: "#f8fafc", paddingVertical: 5 }, activeTab: { backgroundColor: "#fff0e5", borderColor: "#e66b2e", borderWidth: 1.5 }, tabIcon: { fontSize: 18, lineHeight: 21, color: "#40516a", fontWeight: "800" }, tabText: { fontSize: 10, lineHeight: 14, fontWeight: "900", color: "#34445c", marginTop: 2 }, activeTabText: { color: "#c95522" },
  driverCard: { marginTop: 12, borderRadius: 16, padding: 13, backgroundColor: "#effaf3", borderWidth: 1, borderColor: "#d5f0df" },
  driverCardTitle: { fontSize: 10, fontWeight: "900", color: "#166534", marginBottom: 10, letterSpacing: 0.5 },
  driverCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  driverPhoto: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#fff" },
  driverPhotoFallback: { width: 58, height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  driverName: { fontSize: 14, fontWeight: "900", color: NAVY },
  driverMeta: { marginTop: 3, fontSize: 11, color: "#526173" },
  driverPhone: { marginTop: 7, fontSize: 12, fontWeight: "800", color: "#166534" },
  eventOverlay: { flex: 1, backgroundColor: "rgba(16,46,87,0.62)", justifyContent: "center", padding: 18 },
  eventCard: { backgroundColor: "#fff", borderRadius: 26, padding: 18, borderWidth: 1, borderColor: "#ffead8" },
  eventHeader: { alignItems: "center", paddingVertical: 10 },
  eventIcon: { fontSize: 30, backgroundColor: "#fff0df", padding: 13, borderRadius: 18, overflow: "hidden" },
  eventTitle: { marginTop: 12, fontSize: 20, fontWeight: "900", color: NAVY, textAlign: "center" },
  eventSubtitle: { marginTop: 5, fontSize: 12, color: "#738096", textAlign: "center" },
  eventDetails: { marginTop: 14, padding: 14, borderRadius: 17, backgroundColor: "#fff7ef", borderWidth: 1, borderColor: "#ffe4c7" },
  eventLabel: { fontSize: 9, fontWeight: "900", color: "#738096", letterSpacing: 0.8, marginBottom: 8 },
  eventMerchant: { fontSize: 15, fontWeight: "900", color: NAVY },
  eventMeta: { marginTop: 5, fontSize: 11, color: "#526173" },
  eventTotal: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3d9be", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventTotalValue: { fontSize: 16, fontWeight: "900", color: NAVY },
  eventDriver: { marginTop: 12, padding: 14, borderRadius: 17, backgroundColor: "#effaf3", borderWidth: 1, borderColor: "#d5f0df" },
  eventVerified: { marginTop: 10, fontSize: 10, fontWeight: "800", color: "#166534" },
  eventButton: { marginTop: 16, paddingVertical: 14, borderRadius: 28, backgroundColor: NAVY, alignItems: "center" },
  eventButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  orderItems: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1eee9" }, orderDetailTitle: { fontSize: 10, fontWeight: "900", color: NAVY, marginBottom: 7 }, orderItemRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 5 }, orderItemName: { flex: 1, fontSize: 10, color: "#63748a" }, orderItemPrice: { fontSize: 10, fontWeight: "800", color: NAVY }, riderNotice: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#fff7e7", borderWidth: 1, borderColor: "#f3dfb5" }, riderNoticeReady: { backgroundColor: "#eaf8f0", borderColor: "#c7ead4" }, riderNoticeText: { fontSize: 10, lineHeight: 15, color: NAVY, fontWeight: "700" }, orderHistory: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#f1eee9" }, historyRow: { flexDirection: "row", minHeight: 47 }, historyMarker: { width: 17, alignItems: "center" }, historyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#b7c1ce", marginTop: 3 }, historyDotActive: { backgroundColor: ORANGE, width: 11, height: 11, borderRadius: 6 }, historyLine: { width: 1, flex: 1, backgroundColor: "#dfe5ec", marginTop: 3 }, historyBody: { flex: 1, paddingBottom: 10, paddingLeft: 5 }, historyStatus: { fontSize: 10, fontWeight: "900", color: NAVY, textTransform: "capitalize" }, historyDate: { marginTop: 2, fontSize: 9, color: "#8995a7" }, historyNote: { marginTop: 3, fontSize: 9, color: "#63748a", lineHeight: 13 }, deliveryProofButton: { marginTop: 10, alignSelf: "flex-start", borderRadius: 18, backgroundColor: "#e7f7ed", paddingHorizontal: 12, paddingVertical: 8 }, deliveryProofText: { fontSize: 10, fontWeight: "900", color: "#176b43" }, driverNote: { marginTop: 8, fontSize: 10, color: "#63748a", fontStyle: "italic" },
  paymentSummary: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#f1eee9" }, paymentSummaryText: { fontSize: 10, fontWeight: "800", color: NAVY }, gcashCard: { marginTop: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#d9ecf7", backgroundColor: "#f2faff" }, gcashHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, gcashTitle: { fontSize: 14, fontWeight: "900", color: NAVY }, gcashBadge: { overflow: "hidden", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#fff", color: "#17618b", fontSize: 9, fontWeight: "900" }, gcashHint: { marginTop: 7, fontSize: 10, lineHeight: 15, color: "#63748a" }, gcashAmount: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: "#fff" }, gcashTotal: { marginTop: 2, fontSize: 24, fontWeight: "900", color: NAVY }, gcashQrWrap: { alignItems: "center", marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: "#fff" }, gcashQr: { width: 190, height: 190 }, gcashAccount: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#fff" }, gcashAccountValue: { marginTop: 3, fontSize: 13, fontWeight: "900", color: NAVY }, gcashPhone: { marginTop: 2, fontSize: 18, fontWeight: "900", letterSpacing: 1, color: NAVY }, gcashSuccess: { marginTop: 9, padding: 10, borderRadius: 10, backgroundColor: "#e7f7ed", color: "#176b43", fontSize: 11, fontWeight: "800", lineHeight: 17 }, gcashPending: { marginTop: 11, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: "#f1d89b", backgroundColor: "#fff9e9" }, gcashPendingTitle: { fontSize: 11, fontWeight: "900", color: "#805300" }, gcashForm: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#d9ecf7" }, gcashLabel: { marginTop: 8, fontSize: 10, fontWeight: "900", color: NAVY }, gcashInput: { marginTop: 5, paddingHorizontal: 11, paddingVertical: 11, borderWidth: 1, borderColor: "#dce5ed", borderRadius: 10, backgroundColor: "#fff", color: NAVY, fontSize: 12 }, gcashPick: { marginTop: 6, padding: 12, borderRadius: 11, borderWidth: 1, borderStyle: "dashed", borderColor: ORANGE, backgroundColor: "#fff", alignItems: "center" }, gcashPickText: { color: NAVY, fontSize: 11, fontWeight: "900" }, gcashPreviewWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 8, borderRadius: 10, backgroundColor: "#fff" }, gcashPreview: { width: 66, height: 66, borderRadius: 8, backgroundColor: "#edf2f7" }, gcashPreviewName: { fontSize: 10, fontWeight: "800", color: NAVY }, gcashRemove: { marginTop: 6, fontSize: 10, fontWeight: "900", color: RED }, gcashSubmit: { marginTop: 12, paddingVertical: 13, borderRadius: 22, backgroundColor: NAVY, alignItems: "center" }, gcashSubmitText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  orderCard: { backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", padding: 14, marginBottom: 11 },
  progressTracker: { marginTop: 16, marginBottom: 12, paddingHorizontal: 2 }, progressTrackRow: { flexDirection: "row", alignItems: "center" }, progressNodeWrap: { width: 25, height: 25, alignItems: "center", justifyContent: "center" }, progressNode: { width: 23, height: 23, borderRadius: 12, backgroundColor: "#e8edf3", alignItems: "center", justifyContent: "center", zIndex: 1 }, progressNodeComplete: { backgroundColor: RED }, progressNodeCurrent: { backgroundColor: RED, borderWidth: 2, borderColor: "#ffd4b6" }, progressNodeText: { fontSize: 10, fontWeight: "900", color: "#718096" }, progressNodeTextActive: { color: "#fff" }, progressPulse: { position: "absolute", width: 25, height: 25, borderRadius: 13, backgroundColor: ORANGE }, progressConnector: { flex: 1, height: 3, backgroundColor: "#e3e8ef", overflow: "hidden", borderRadius: 2 }, progressConnectorComplete: { backgroundColor: RED }, progressConnectorActive: { backgroundColor: "#f6d5c2" }, progressFlowDash: { position: "absolute", left: 0, top: 0, bottom: 0, width: 18, backgroundColor: RED, borderRadius: 2 }, progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 }, progressLabelWrap: { flex: 1, alignItems: "center", paddingHorizontal: 1 }, progressLabel: { fontSize: 8, fontWeight: "700", color: "#8b96a5", textAlign: "center" }, progressLabelComplete: { color: NAVY }, progressLabelActive: { color: NAVY, fontWeight: "900" }, priceFeeNote: { fontSize: 7, color: "#7c8796", fontWeight: "600" }, orderTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, orderNumber: { fontSize: 10, fontWeight: "900", color: "#8995a7" }, statusPill: { fontSize: 9, fontWeight: "900", color: RED, backgroundColor: "#fff0df", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, alignSelf: "flex-start", maxWidth: 135 }, orderAmounts: { marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1eee9" }, amountRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 }, amountLabel: { fontSize: 10, color: "#738096" }, amountValue: { fontSize: 10, fontWeight: "700", color: NAVY }, deliveryLabel: { fontSize: 11, fontWeight: "800", color: RED }, deliveryValue: { fontSize: 11, fontWeight: "800", color: RED }, totalRow: { borderTopWidth: 1, borderTopColor: "#f1eee9", paddingTop: 8, marginTop: 9 }, totalLabel: { fontSize: 12, fontWeight: "900", color: NAVY }, totalValue: { fontSize: 14, fontWeight: "900", color: NAVY },
  accountCard: { backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#ffead8", padding: 19 }, accountLink: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1eee9" }, accountLinkText: { fontSize: 12, fontWeight: "800", color: NAVY },
  checkoutSafe: { flex: 1, backgroundColor: BG }, checkoutContent: { padding: 18, paddingBottom: 36 }, checkoutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, checkoutTitle: { fontSize: 22, fontWeight: "900", color: NAVY }, checkoutCard: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#ffead8", padding: 15, marginBottom: 13 }, checkoutSection: { fontSize: 15, fontWeight: "900", color: NAVY, marginBottom: 10 }, addressOption: { borderWidth: 1, borderColor: "#edf0f3", borderRadius: 13, padding: 11, marginBottom: 8 }, addressOptionActive: { borderColor: ORANGE, backgroundColor: "#fff7ef" }, addressOptionTitle: { fontSize: 12, fontWeight: "900", color: NAVY }, addressOptionText: { fontSize: 10, color: "#738096", marginTop: 4 }, addressToggle: { paddingVertical: 10 }, addressToggleText: { fontSize: 11, fontWeight: "900", color: RED }, checkoutInput: { marginTop: 9, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5eaf0", backgroundColor: "#fff", color: NAVY, fontSize: 12 }, checkoutMultiline: { minHeight: 72, textAlignVertical: "top" }, checkoutHint: { fontSize: 10, color: "#738096", lineHeight: 15, marginTop: 6 }, municipalityOption: { borderWidth: 1, borderColor: "#edf0f3", borderRadius: 10, padding: 9, marginTop: 5 }, checkoutAmountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 8 }, checkoutAmountLabel: { flex: 1, fontSize: 11, color: "#738096" }, checkoutAmountValue: { fontSize: 11, fontWeight: "800", color: NAVY }, checkoutDeliveryLabel: { fontSize: 11, fontWeight: "800", color: RED }, checkoutTotalRow: { borderTopWidth: 1, borderTopColor: "#f1eee9", paddingTop: 10, marginTop: 12 }, checkoutTotalLabel: { fontSize: 13, fontWeight: "900", color: NAVY }, paymentOption: { borderWidth: 1, borderColor: "#edf0f3", borderRadius: 13, padding: 12, marginBottom: 8 }, paymentTitle: { fontSize: 12, fontWeight: "900", color: NAVY }, checkoutFootnote: { fontSize: 10, lineHeight: 16, color: "#738096", textAlign: "center", marginTop: 10 }
});

export default function App() {
  return <SafeAreaProvider><CustomerApp /></SafeAreaProvider>;
}
