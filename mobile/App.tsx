import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "./src/lib/supabase";

type Product = { id: string; name: string; description: string | null; price: number | string; image_url: string | null; merchant: { name: string } | { name: string }[] | null; branch: { name: string; municipalities: { name: string } | { name: string }[] | null } | { name: string; municipalities: { name: string } | { name: string }[] | null }[] | null };
type Order = { id: string; order_number: string; status: string; subtotal: number | string; delivery_fee: number | string; total: number | string; placed_at: string; merchants: { name: string } | { name: string }[] | null };

const peso = (v: number | string) => "₱" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const one = <T,>(v: T | T[] | null): T | null => Array.isArray(v) ? v[0] ?? null : v;

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"market" | "orders" | "account">("market");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadCustomerData();
  }, [session?.user?.id, tab]);

  async function loadCustomerData() {
    setLoadingData(true);
    try {
      if (tab === "market") {
        const { data, error } = await supabase.from("products")
          .select("id,name,description,price,image_url,merchant:merchants!products_merchant_id_fkey(name),branch:merchant_branches!products_branch_id_fkey(name,municipalities(name))")
          .eq("is_available", true).order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        setProducts((data ?? []) as unknown as Product[]);
      } else if (tab === "orders") {
        const { data, error } = await supabase.from("orders")
          .select("id,order_number,status,subtotal,delivery_fee,total,placed_at,merchants(name)")
          .eq("customer_id", session.user.id).order("placed_at", { ascending: false }).limit(50);
        if (error) throw error;
        setOrders((data ?? []) as unknown as Order[]);
      }
    } catch (e: any) {
      Alert.alert("Unable to refresh", e?.message ?? "Please try again.");
    } finally { setLoadingData(false); }
  }

  async function signIn() {
    if (!email.trim() || !password) { Alert.alert("Missing details", "Enter your email and password."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) { Alert.alert("Sign in failed", error.message); setBusy(false); return; }
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      Alert.alert("Email verification required", "Please confirm your email address using the link sent by SUGOMATE, then sign in again.");
      setBusy(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("phone_verified_at").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile?.phone_verified_at) {
      await supabase.auth.signOut();
      Alert.alert("Mobile verification required", "Please complete the Philippine mobile SMS verification on sugomate.com/register before signing in.");
      setBusy(false);
      return;
    }
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (roleError) { await supabase.auth.signOut(); Alert.alert("Account check failed", "We could not verify your SUGOMATE account access."); setBusy(false); return; }
    const roles = new Set((roleRows ?? []).map((r: any) => r.role));
    if (!roles.has("customer")) {
      await supabase.auth.signOut();
      Alert.alert("Customer access only", "This first release is for customer accounts. Driver and merchant access will be added in later phases.");
    }
    setBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); setProducts([]); setOrders([]); }

  if (checking) return <View style={styles.center}><ActivityIndicator size="large" color="#ff8a00" /></View>;
  if (!session) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.loginWrap}>
    <View style={styles.brandMark}><Text style={styles.brandS}>S</Text></View>
    <Text style={styles.brand}>SUGOMATE</Text><Text style={styles.tagline}>Imong sugo, among ihatod.</Text>
    <View style={styles.loginCard}><Text style={styles.heading}>Welcome back</Text><Text style={styles.muted}>Sign in to order from local stores.</Text>
      <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#8995a7" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8995a7" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={signIn} disabled={busy}><Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL("https://sugomate.com/register?next=%2Fcustomer")}><Text style={styles.link}>Create customer account</Text></TouchableOpacity>
      <Text style={styles.footnote}>New accounts complete email confirmation and Philippine mobile SMS verification before ordering.</Text>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" />
    <View style={styles.topbar}><View><Text style={styles.topBrand}>SUGOMATE</Text><Text style={styles.topTag}>Imong sugo, among ihatod.</Text></View><TouchableOpacity onPress={loadCustomerData}><Text style={styles.refresh}>Refresh</Text></TouchableOpacity></View>
    <View style={styles.pageTitle}><Text style={styles.heading}>{tab === "market" ? "Find what you need" : tab === "orders" ? "My orders" : "Your account"}</Text><Text style={styles.muted}>{tab === "market" ? "Local stores and available products" : tab === "orders" ? "Track your orders and delivery status" : session.user.email}</Text></View>
    {loadingData && <ActivityIndicator style={{ marginVertical: 12 }} color="#ff8a00" />}
    {tab === "market" && <FlatList data={products} keyExtractor={p => p.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No available products at the moment. Please check back soon.</Text>} renderItem={({ item }) => {
      const merchant = one(item.merchant); const branch = one(item.branch); const area = one(branch?.municipalities ?? null);
      return <View style={styles.product}><View style={styles.productIcon}><Text style={{fontSize:24}}>🛍️</Text></View><View style={{flex:1}}><Text style={styles.productName}>{item.name}</Text><Text style={styles.productMeta}>{merchant?.name ?? "Local store"}{area?.name ? " · " + area.name : ""}</Text>{item.description ? <Text style={styles.productMeta} numberOfLines={2}>{item.description}</Text> : null}</View><Text style={styles.price}>{peso(item.price)}</Text></View>;
    }} />}
    {tab === "orders" && <FlatList data={orders} keyExtractor={o => o.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>You have no orders yet.</Text>} renderItem={({ item }) => <View style={styles.order}><View style={styles.orderTop}><Text style={styles.productName}>{item.order_number}</Text><Text style={styles.status}>{item.status.replaceAll("_", " ")}</Text></View><Text style={styles.productMeta}>{one(item.merchants)?.name ?? "SUGOMATE merchant"}</Text><View style={styles.orderTotal}><Text style={styles.productMeta}>Delivery fee {peso(item.delivery_fee)}</Text><Text style={styles.price}>{peso(item.total)}</Text></View></View>} />}
    {tab === "account" && <View style={styles.accountCard}><Text style={styles.productName}>Signed in as</Text><Text style={styles.muted}>{session.user.email}</Text><TouchableOpacity style={styles.primary} onPress={signOut}><Text style={styles.primaryText}>Sign out</Text></TouchableOpacity></View>}
    <View style={styles.tabbar}>{(["market","orders","account"] as const).map(t => <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.activeTab]}><Text style={[styles.tabText, tab === t && styles.activeTabText]}>{t === "market" ? "Marketplace" : t === "orders" ? "My Orders" : "Account"}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff7ef"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#fff7ef"},loginWrap:{flex:1,justifyContent:"center",padding:24},brandMark:{alignSelf:"center",width:64,height:64,borderRadius:22,backgroundColor:"#102e57",alignItems:"center",justifyContent:"center"},brandS:{fontSize:38,fontWeight:"900",color:"#ff8a00"},brand:{marginTop:14,textAlign:"center",fontSize:25,fontWeight:"900",letterSpacing:2,color:"#102e57"},tagline:{textAlign:"center",color:"#e95718",marginTop:4,fontWeight:"600"},loginCard:{marginTop:34,padding:22,borderRadius:26,backgroundColor:"#fff",borderWidth:1,borderColor:"#ffead8"},heading:{fontSize:24,fontWeight:"900",color:"#102e57"},muted:{fontSize:13,color:"#738096",marginTop:5},input:{marginTop:16,paddingHorizontal:15,paddingVertical:14,borderRadius:14,borderWidth:1,borderColor:"#e5eaf0",fontSize:15,color:"#102e57",backgroundColor:"#fff"},primary:{marginTop:18,backgroundColor:"#ff8a00",padding:15,borderRadius:15,alignItems:"center"},disabled:{opacity:.6},primaryText:{color:"#fff",fontWeight:"900",fontSize:15},linkButton:{alignItems:"center",padding:15},link:{color:"#e95718",fontWeight:"800"},footnote:{fontSize:11,color:"#8995a7",lineHeight:17,textAlign:"center"},topbar:{paddingHorizontal:18,paddingVertical:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:"#fff"},topBrand:{fontSize:20,fontWeight:"900",letterSpacing:1.4,color:"#102e57"},topTag:{fontSize:10,color:"#e95718",marginTop:2},refresh:{fontSize:13,color:"#e95718",fontWeight:"800"},pageTitle:{paddingHorizontal:18,paddingVertical:18},list:{paddingHorizontal:14,paddingBottom:100},product:{backgroundColor:"#fff",padding:14,borderRadius:18,marginBottom:10,flexDirection:"row",alignItems:"center",gap:12,borderWidth:1,borderColor:"#ffead8"},productIcon:{width:48,height:48,borderRadius:14,backgroundColor:"#fff0df",alignItems:"center",justifyContent:"center"},productName:{fontSize:14,fontWeight:"800",color:"#102e57"},productMeta:{fontSize:11,color:"#8995a7",marginTop:4},price:{fontSize:14,fontWeight:"900",color:"#e95718"},empty:{textAlign:"center",color:"#8995a7",padding:30,fontSize:13},tabbar:{position:"absolute",bottom:0,left:0,right:0,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#f0e3d9",flexDirection:"row",paddingVertical:10,paddingBottom:16},tab:{flex:1,alignItems:"center",padding:9,borderRadius:12,marginHorizontal:5},activeTab:{backgroundColor:"#fff0df"},tabText:{fontSize:11,fontWeight:"700",color:"#8995a7"},activeTabText:{color:"#102e57"},order:{backgroundColor:"#fff",padding:16,borderRadius:18,marginBottom:10,borderWidth:1,borderColor:"#ffead8"},orderTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},status:{fontSize:10,fontWeight:"800",color:"#e95718",textTransform:"capitalize"},orderTotal:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:"#f3eee9"},accountCard:{margin:16,padding:20,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:"#ffead8"}
});
