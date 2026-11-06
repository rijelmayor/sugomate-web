import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "./src/lib/supabase";

type Category = { id: string; name: string; slug: string; icon: string; image_url?: string | null };
type Municipality = { id: string; name: string };
type Product = { id: string; name: string; description: string | null; price: number | string; image_url: string | null; branch_id: string; merchant: any; branch: any };
type Store = { id: string; name: string; branchName: string; categorySlug: string; area: string; count: number; image: string | null; isOpen: boolean };
type Order = { id: string; order_number: string; status: string; subtotal: number | string; delivery_fee: number | string; total: number | string; placed_at: string; merchants: any };
type Cart = Record<string, { product: Product; quantity: number }>;
type Tab = "market" | "orders" | "account";

const NAVY = "#102e57";
const ORANGE = "#ff8a00";
const RED = "#e95718";
const BG = "#fff7ef";
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

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("market");
  const [profileName, setProfileName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadMarketplace = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const [profileRes, municipalityRes, categoryRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle(),
        supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
        supabase.from("merchant_categories").select("id,name,slug,icon,image_url").eq("is_active", true).order("sort_order").order("name")
      ]);
      if (profileRes.error) throw profileRes.error;
      if (municipalityRes.error) throw municipalityRes.error;
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
          categorySlug: m?.store_category?.slug ?? "other", area: b?.municipalities?.name ?? "",
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
      const { data, error } = await supabase.from("orders").select("id,order_number,status,subtotal,delivery_fee,total,placed_at,merchants(name)").eq("customer_id", session.user.id).order("placed_at", { ascending: false }).limit(50);
      if (error) throw error;
      setOrders((data ?? []) as unknown as Order[]);
    } catch (e: any) { Alert.alert("Unable to load orders", e?.message ?? "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session?.user?.id]);

  useEffect(() => { if (session?.user?.id) void loadMarketplace(); }, [session?.user?.id, loadMarketplace]);
  useEffect(() => { if (tab === "orders" && session?.user?.id) void loadOrders(); }, [tab, session?.user?.id, loadOrders]);

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

  const visibleStores = useMemo(() => stores.filter(s =>
    (!selectedCategory || s.categorySlug === selectedCategory) &&
    (!selectedMunicipality || products.some(p => p.branch_id === s.id && p.branch?.municipality_id === selectedMunicipality)) &&
    (!search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()) || s.area.toLowerCase().includes(search.trim().toLowerCase()))
  ), [stores, products, selectedCategory, selectedMunicipality, search]);
  const currentStore = stores.find(s => s.id === selectedStore);
  const storeProducts = useMemo(() => products.filter(p => p.branch_id === selectedStore && (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))), [products, selectedStore, search]);
  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((n, item) => n + item.quantity, 0);
  const cartTotal = cartItems.reduce((n, item) => n + Number(item.product.price) * item.quantity, 0);

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
    if (roleError || !(roleRows ?? []).some((r: any) => r.role === "customer")) {
      await supabase.auth.signOut();
      Alert.alert("Customer access only", "This app area is for verified customer accounts.");
    }
    setBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); setCart({}); setOrders([]); setProducts([]); setStores([]); }
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
  function showBasket() {
    const lines = cartItems.map(x => x.quantity + " × " + x.product.name + " — " + peso(Number(x.product.price) * x.quantity)).join("\n");
    Alert.alert("Your basket", lines + "\n\nItems subtotal: " + peso(cartTotal) + "\n\nDelivery fee is calculated at checkout.", [
      { text: "Continue shopping", style: "cancel" },
      { text: "Clear basket", style: "destructive", onPress: () => setCart({}) }
    ]);
  }

  if (checking) return <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>;
  if (!session) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.loginWrap}>
    <View style={styles.brandMark}><Text style={styles.brandS}>S</Text></View>
    <Text style={styles.brand}>SUGOMATE</Text><Text style={styles.tagline}>Imong sugo, kami bahala.</Text>
    <View style={styles.loginCard}><Text style={styles.heading}>Welcome back</Text><Text style={styles.muted}>Sign in to order from local stores.</Text>
      <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#8995a7" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8995a7" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={signIn} disabled={busy}><Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL("https://sugomate.com/register?next=%2Fcustomer")}><Text style={styles.link}>Create customer account</Text></TouchableOpacity>
      <Text style={styles.footnote}>New accounts complete email confirmation and Philippine mobile SMS verification before ordering.</Text>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;

  const firstName = profileName.split(/\s+/)[0] || "there";
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" />
    <View style={styles.topbar}>
      <View style={styles.brandRow}><View style={styles.smallMark}><Text style={styles.smallMarkText}>S</Text></View><View><Text style={styles.topBrand}>SUGOMATE</Text><Text style={styles.topTag}>Imong sugo, kami bahala.</Text></View></View>
      <TouchableOpacity style={styles.ordersShortcut} onPress={() => setTab("orders")}><Text style={styles.ordersShortcutText}>My Orders</Text></TouchableOpacity>
    </View>
    <View style={styles.greeting}><Text style={styles.greetingSmall}>Maayong adlaw, {firstName}!</Text><Text style={styles.greetingTitle}>Unsa imong sugo karon?</Text></View>
    <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput style={styles.searchInput} placeholder={selectedStore ? "Search this store's items…" : "Search stores or areas…"} placeholderTextColor="#9aa4b3" value={search} onChangeText={setSearch} />{!!search && <TouchableOpacity onPress={() => setSearch("")}><Text style={styles.clearSearch}>×</Text></TouchableOpacity>}</View>
    {!selectedStore && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaScroll} contentContainerStyle={styles.areaContent}>
      <TouchableOpacity onPress={() => setSelectedMunicipality("")} style={[styles.areaChip, !selectedMunicipality && styles.areaChipActive]}><Text style={[styles.areaChipText, !selectedMunicipality && styles.areaChipTextActive]}>All areas</Text></TouchableOpacity>
      {municipalities.map(m => <TouchableOpacity key={m.id} onPress={() => setSelectedMunicipality(m.id)} style={[styles.areaChip, selectedMunicipality === m.id && styles.areaChipActive]}><Text style={[styles.areaChipText, selectedMunicipality === m.id && styles.areaChipTextActive]}>{m.name}</Text></TouchableOpacity>)}
    </ScrollView>}
    {loading && <ActivityIndicator style={{ marginVertical: 8 }} color={ORANGE} />}
    <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (tab === "orders") void loadOrders(); else void loadMarketplace(); }} tintColor={ORANGE} />} >
      {tab === "market" && <>
        {selectedStore && currentStore ? <>
          <TouchableOpacity style={styles.backLink} onPress={() => { setSelectedStore(""); setSearch(""); }}><Text style={styles.backLinkText}>‹  Back to stores</Text></TouchableOpacity>
          <View style={styles.storeHero}>{currentStore.image ? <Image source={{ uri: currentStore.image }} style={styles.storeHeroImage} /> : <Text style={styles.storeHeroIcon}>🏪</Text>}
            <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{currentStore.name}</Text><Text style={styles.muted}>{currentStore.branchName} · {currentStore.area}</Text><Text style={[styles.openLabel, currentStore.isOpen ? styles.open : styles.closed]}>{currentStore.isOpen ? "Open now" : "Closed"}</Text></View></View>
          {currentStore.isOpen ? storeProducts.map(p => <View key={p.id} style={styles.productCard}>
            {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.productImage} resizeMode="contain" /> : <View style={styles.productPlaceholder}><Text style={{ fontSize: 27 }}>🛍️</Text></View>}
            <View style={styles.productInfo}><Text style={styles.productName}>{p.name}</Text><Text style={styles.productDescription} numberOfLines={2}>{p.description ?? ""}</Text><View style={styles.productBottom}><Text style={styles.price}>{peso(p.price)}</Text><View style={styles.qtyRow}>{cart[p.id] ? <><TouchableOpacity onPress={() => changeQuantity(p.id, -1)} style={styles.qtyButton}><Text style={styles.qtyText}>−</Text></TouchableOpacity><Text style={styles.qtyValue}>{cart[p.id].quantity}</Text><TouchableOpacity onPress={() => changeQuantity(p.id, 1)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></TouchableOpacity></> : <TouchableOpacity onPress={() => addToCart(p)} style={styles.addButton}><Text style={styles.addButtonText}>＋ Add</Text></TouchableOpacity>}</View></View></View>
          </View>) : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🕒</Text><Text style={styles.emptyTitle}>This store is currently closed</Text><Text style={styles.muted}>Please check back during its operating hours.</Text></View>}
          {currentStore.isOpen && storeProducts.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No items available right now</Text><Text style={styles.muted}>Please check back soon.</Text></View>}
        </> : <>
          <Text style={styles.sectionTitle}>Browse by category</Text><Text style={styles.sectionSub}>Pick what you need — we'll show you the stores.</Text>
          <View style={styles.categoryGrid}>{categories.map(c => <TouchableOpacity key={c.id} style={styles.categoryCard} onPress={() => setSelectedCategory(selectedCategory === c.slug ? "" : c.slug)}>
            {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.categoryImage} /> : <View style={styles.categoryFallback}><Text style={styles.categoryEmoji}>{categoryEmoji(c.slug)}</Text></View>}
            <View style={styles.categoryShade} /><View style={styles.categoryCaption}><Text style={styles.categoryName}>{c.name}</Text><Text style={styles.categoryCount}>{stores.filter(s => s.categorySlug === c.slug).length} stores</Text></View>
            {selectedCategory === c.slug && <View style={styles.categorySelected}><Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text></View>}
          </TouchableOpacity>)}</View>
          <View style={styles.storesHeading}><Text style={styles.sectionTitle}>{selectedCategory ? (categories.find(c => c.slug === selectedCategory)?.name ?? "Stores") : "Stores near you"}</Text><Text style={styles.storeCount}>{visibleStores.length} {visibleStores.length === 1 ? "store" : "stores"}</Text></View>
          {visibleStores.map(s => <TouchableOpacity key={s.id} style={styles.storeCard} onPress={() => { if (!s.isOpen) { Alert.alert("Store closed", "This store is not accepting orders right now."); return; } setSelectedStore(s.id); setSearch(""); }}>
            {s.image ? <Image source={{ uri: s.image }} style={styles.storeImage} /> : <View style={styles.storeImageFallback}><Text style={{ fontSize: 25 }}>🏪</Text></View>}
            <View style={styles.storeInfo}><Text style={styles.storeName}>{s.name}</Text>{!!s.branchName && <Text style={styles.storeBranch}>{s.branchName}</Text>}<Text style={styles.storeArea}>⌖  {s.area || "Leyte"}</Text><Text style={[styles.openLabel, s.isOpen ? styles.open : styles.closed]}>{s.isOpen ? "Open now" : "Closed"}</Text></View><Text style={styles.chevron}>›</Text>
          </TouchableOpacity>)}
          {visibleStores.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛍️</Text><Text style={styles.emptyTitle}>No stores found</Text><Text style={styles.muted}>Try another category, search, or service area.</Text></View>}
        </>}
      </>}
      {tab === "orders" && <>
        <Text style={styles.sectionTitle}>My orders</Text><Text style={styles.sectionSub}>Follow your orders from store confirmation through delivery.</Text>
        {orders.map(o => <View key={o.id} style={styles.orderCard}><View style={styles.orderTop}><View><Text style={styles.orderNumber}>{o.order_number}</Text><Text style={styles.storeName}>{one(o.merchants)?.name ?? "Local merchant"}</Text><Text style={styles.storeBranch}>{new Date(o.placed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</Text></View><Text style={styles.statusPill}>{orderStatus[o.status] ?? o.status.replaceAll("_", " ")}</Text></View><View style={styles.orderAmounts}><View style={styles.amountRow}><Text style={styles.amountLabel}>Items subtotal</Text><Text style={styles.amountValue}>{peso(o.subtotal)}</Text></View><View style={styles.amountRow}><Text style={styles.deliveryLabel}>Delivery fee</Text><Text style={styles.deliveryValue}>{peso(o.delivery_fee)}</Text></View><View style={[styles.amountRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{peso(o.total)}</Text></View></View></View>)}
        {!loading && orders.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛵</Text><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Your placed orders will appear here.</Text><TouchableOpacity onPress={() => setTab("market")} style={styles.primary}><Text style={styles.primaryText}>Browse marketplace</Text></TouchableOpacity></View>}
      </>}
      {tab === "account" && <View style={styles.accountCard}><Text style={styles.sectionTitle}>Your account</Text><Text style={styles.muted}>{session.user.email}</Text><TouchableOpacity style={styles.accountLink} onPress={() => Linking.openURL("https://sugomate.com/customer/addresses")}><Text style={styles.accountLinkText}>Manage saved addresses  ›</Text></TouchableOpacity><TouchableOpacity style={styles.accountLink} onPress={() => setTab("orders")}><Text style={styles.accountLinkText}>My orders  ›</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, { marginTop: 22 }]} onPress={signOut}><Text style={styles.primaryText}>Sign out</Text></TouchableOpacity></View>}
    </ScrollView>
    {tab === "market" && cartCount > 0 && <TouchableOpacity style={styles.basketBar} onPress={showBasket}><Text style={styles.basketText}>{cartCount} {cartCount === 1 ? "item" : "items"} · View basket</Text><Text style={styles.basketTotal}>{peso(cartTotal)}</Text></TouchableOpacity>}
    <View style={styles.tabbar}>{(["market", "orders", "account"] as Tab[]).map(t => <TouchableOpacity key={t} onPress={() => { setTab(t); if (t !== "market") setSelectedStore(""); }} style={[styles.tab, tab === t && styles.activeTab]}><Text style={[styles.tabIcon, tab === t && styles.activeTabText]}>{t === "market" ? "⌂" : t === "orders" ? "▤" : "◉"}</Text><Text style={[styles.tabText, tab === t && styles.activeTabText]}>{t === "market" ? "Marketplace" : t === "orders" ? "My Orders" : "Account"}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG },
  loginWrap: { flex: 1, justifyContent: "center", padding: 24 }, brandMark: { alignSelf: "center", width: 64, height: 64, borderRadius: 22, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  brandS: { fontSize: 38, fontWeight: "900", color: ORANGE }, brand: { marginTop: 14, textAlign: "center", fontSize: 25, fontWeight: "900", letterSpacing: 2, color: NAVY }, tagline: { textAlign: "center", color: RED, marginTop: 4, fontWeight: "700" },
  loginCard: { marginTop: 34, padding: 22, borderRadius: 26, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ffead8" }, heading: { fontSize: 24, fontWeight: "900", color: NAVY }, muted: { fontSize: 12, color: "#738096", marginTop: 5, lineHeight: 18 },
  input: { marginTop: 16, paddingHorizontal: 15, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e5eaf0", fontSize: 15, color: NAVY, backgroundColor: "#fff" },
  primary: { marginTop: 18, backgroundColor: ORANGE, padding: 14, borderRadius: 15, alignItems: "center" }, disabled: { opacity: .6 }, primaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  linkButton: { alignItems: "center", padding: 15 }, link: { color: RED, fontWeight: "800" }, footnote: { fontSize: 11, color: "#8995a7", lineHeight: 17, textAlign: "center" },
  topbar: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff" }, brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  smallMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }, smallMarkText: { fontSize: 22, fontWeight: "900", color: ORANGE },
  topBrand: { fontSize: 17, fontWeight: "900", letterSpacing: 1.1, color: NAVY }, topTag: { fontSize: 9, color: RED, marginTop: 1 }, ordersShortcut: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#ffead8" }, ordersShortcutText: { fontSize: 11, fontWeight: "800", color: NAVY },
  greeting: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 13 }, greetingSmall: { fontSize: 12, fontWeight: "800", color: RED }, greetingTitle: { fontSize: 21, fontWeight: "900", color: NAVY, marginTop: 4 },
  searchWrap: { marginHorizontal: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ffead8", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }, searchIcon: { fontSize: 23, color: "#9aa4b3" }, searchInput: { flex: 1, height: 44, fontSize: 13, color: NAVY, paddingHorizontal: 8 }, clearSearch: { fontSize: 22, color: "#8995a7", paddingHorizontal: 5 },
  areaScroll: { maxHeight: 48, marginTop: 8, flexGrow: 0 }, areaContent: { paddingHorizontal: 14, alignItems: "center", gap: 7 }, areaChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e9e3dc" }, areaChipActive: { backgroundColor: NAVY, borderColor: NAVY }, areaChipText: { fontSize: 10, fontWeight: "700", color: NAVY }, areaChipTextActive: { color: "#fff" },
  content: { flex: 1 }, contentInner: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 105 }, sectionTitle: { fontSize: 18, fontWeight: "900", color: NAVY }, sectionSub: { fontSize: 11, color: "#738096", marginTop: 3, marginBottom: 13 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 }, categoryCard: { width: "48%", height: 145, borderRadius: 18, overflow: "hidden", backgroundColor: NAVY }, categoryImage: { width: "100%", height: "100%", position: "absolute" }, categoryFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#294d75" }, categoryEmoji: { fontSize: 42 }, categoryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,23,46,0.32)" }, categoryCaption: { position: "absolute", bottom: 11, left: 11, right: 8 }, categoryName: { fontSize: 13, fontWeight: "900", color: "#fff" }, categoryCount: { fontSize: 10, fontWeight: "700", color: "#fff", marginTop: 3 }, categorySelected: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  storesHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 10 }, storeCount: { fontSize: 10, color: "#8995a7", fontWeight: "700" },
  storeCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", padding: 11, marginBottom: 9, gap: 11 }, storeImage: { width: 66, height: 66, borderRadius: 14, resizeMode: "contain", backgroundColor: "#fff7ef" }, storeImageFallback: { width: 66, height: 66, borderRadius: 14, backgroundColor: "#fff0df", alignItems: "center", justifyContent: "center" }, storeInfo: { flex: 1 }, storeName: { fontSize: 13, fontWeight: "900", color: NAVY }, storeBranch: { fontSize: 10, color: "#8995a7", marginTop: 3 }, storeArea: { fontSize: 10, color: "#8995a7", marginTop: 4 }, openLabel: { fontSize: 9, fontWeight: "800", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginTop: 5 }, open: { backgroundColor: "#e7f7ed", color: "#177245" }, closed: { backgroundColor: "#f1f2f4", color: "#697586" }, chevron: { fontSize: 25, color: "#c1c9d2", paddingHorizontal: 5 },
  backLink: { marginBottom: 12 }, backLinkText: { fontSize: 12, fontWeight: "800", color: RED }, storeHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: "#fff", marginBottom: 13, borderWidth: 1, borderColor: "#ffead8" }, storeHeroImage: { width: 62, height: 62, borderRadius: 14, resizeMode: "contain" }, storeHeroIcon: { fontSize: 40, width: 62, textAlign: "center" },
  productCard: { flexDirection: "row", padding: 10, backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", marginBottom: 10, gap: 10 }, productImage: { width: 104, height: 112, borderRadius: 13, backgroundColor: "#fff7ef" }, productPlaceholder: { width: 104, height: 112, borderRadius: 13, backgroundColor: "#fff0df", alignItems: "center", justifyContent: "center" }, productInfo: { flex: 1, justifyContent: "space-between", paddingVertical: 3 }, productName: { fontSize: 13, fontWeight: "900", color: NAVY }, productDescription: { fontSize: 10, color: "#8995a7", marginTop: 4 }, productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5, marginTop: 7 }, price: { fontSize: 14, fontWeight: "900", color: RED }, qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 }, qtyButton: { width: 27, height: 27, borderRadius: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }, qtyText: { fontSize: 17, color: "#fff", fontWeight: "900" }, qtyValue: { fontSize: 12, fontWeight: "900", color: NAVY }, addButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: NAVY }, addButtonText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  emptyCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#ffead8", padding: 25, marginTop: 10 }, emptyIcon: { fontSize: 34 }, emptyTitle: { fontSize: 14, fontWeight: "900", color: NAVY, marginTop: 8 },
  basketBar: { position: "absolute", bottom: 72, left: 15, right: 15, backgroundColor: ORANGE, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 5 }, basketText: { fontSize: 12, fontWeight: "900", color: "#fff" }, basketTotal: { fontSize: 13, fontWeight: "900", color: "#fff" },
  tabbar: { height: 62, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0e3d9", flexDirection: "row", paddingTop: 7, paddingBottom: 5 }, tab: { flex: 1, alignItems: "center", justifyContent: "center" }, activeTab: {}, tabIcon: { fontSize: 19, color: "#8995a7" }, tabText: { fontSize: 9, fontWeight: "700", color: "#8995a7", marginTop: 2 }, activeTabText: { color: RED },
  orderCard: { backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ffead8", padding: 14, marginBottom: 11 }, orderTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, orderNumber: { fontSize: 10, fontWeight: "900", color: "#8995a7" }, statusPill: { fontSize: 9, fontWeight: "900", color: RED, backgroundColor: "#fff0df", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, alignSelf: "flex-start", maxWidth: 135 }, orderAmounts: { marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1eee9" }, amountRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 }, amountLabel: { fontSize: 10, color: "#738096" }, amountValue: { fontSize: 10, fontWeight: "700", color: NAVY }, deliveryLabel: { fontSize: 11, fontWeight: "800", color: RED }, deliveryValue: { fontSize: 11, fontWeight: "800", color: RED }, totalRow: { borderTopWidth: 1, borderTopColor: "#f1eee9", paddingTop: 8, marginTop: 9 }, totalLabel: { fontSize: 12, fontWeight: "900", color: NAVY }, totalValue: { fontSize: 14, fontWeight: "900", color: NAVY },
  accountCard: { backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#ffead8", padding: 19 }, accountLink: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1eee9" }, accountLinkText: { fontSize: 12, fontWeight: "800", color: NAVY }
});