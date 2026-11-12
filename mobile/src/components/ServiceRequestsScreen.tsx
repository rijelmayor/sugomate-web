import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "../lib/supabase";

type Props = { userId: string; onBack: () => void; initialServiceType?: "papalit" | "pasugo" | null };
type Address = { id: string; label: string; recipient_name: string; recipient_phone: string; address_line: string; landmark: string | null; municipality_id: string; municipalities: any };
type ServiceRequest = {
  id: string; request_number: string; service_type: "papalit" | "pasugo"; status: string;
  request_title: string; items: any[]; delivery_address_snapshot: any; pickup_location: string | null;
  customer_budget: number | string | null; approved_purchase_budget: number | string | null;
  actual_purchase_amount: number | string | null; delivery_fee: number | string | null;
  service_fee: number | string | null; quoted_total: number | string | null; payment_status: string;
  payment_method: string | null; amount_collected: number | string | null; created_at: string;
};
type RequestEvent = { id: string; service_request_id: string; event_type: string; note: string | null; created_at: string };

const NAVY = "#102e57", ORANGE = "#ff8a00", BG = "#fff7ef";
const money = (value: number | string | null) => "₱" + Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusLabel: Record<string,string> = {
  pending_review: "Under review", quoted: "Estimate ready", awaiting_payment: "Awaiting payment",
  paid: "Paid · awaiting rider", assigned: "Rider assigned", shopping: "Rider shopping",
  purchased: "Purchased", picked_up: "Picked up", in_transit: "On the way",
  delivered: "Delivered", cancelled: "Cancelled"
};
const eventLabel = (value: string) => value.replaceAll("_", " ").replace(/^\w/, c => c.toUpperCase());

export default function ServiceRequestsScreen({ userId, onBack, initialServiceType = null }: Props) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceType, setServiceType] = useState<"papalit" | "pasugo" | null>(initialServiceType);
  const [title, setTitle] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [budget, setBudget] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  const [purchaseRequired, setPurchaseRequired] = useState(true);
  const [addressId, setAddressId] = useState("");
  const [reference, setReference] = useState<{uri:string;mimeType:string;fileName:string;size:number}|null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [addressResult, requestResult] = await Promise.all([
      supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,landmark,municipality_id,municipalities(name)").eq("customer_id", userId).order("created_at", { ascending: false }),
      supabase.from("service_requests").select("id,request_number,service_type,status,request_title,items,delivery_address_snapshot,pickup_location,customer_budget,approved_purchase_budget,actual_purchase_amount,delivery_fee,service_fee,quoted_total,payment_status,payment_method,amount_collected,created_at").eq("customer_id", userId).order("created_at", { ascending: false }).limit(100)
    ]);
    if (addressResult.error) Alert.alert("Unable to load addresses", addressResult.error.message);
    if (requestResult.error) Alert.alert("Unable to load service requests", requestResult.error.message);
    setAddresses((addressResult.data ?? []) as Address[]);
    const rows = (requestResult.data ?? []) as ServiceRequest[];
    setRequests(rows);
    const ids = rows.map(row => row.id);
    if (ids.length) {
      const { data, error } = await supabase.from("service_request_events").select("id,service_request_id,event_type,note,created_at").in("service_request_id", ids).order("created_at", { ascending: true });
      if (error) Alert.alert("Unable to load request activity", error.message);
      setEvents((data ?? []) as RequestEvent[]);
    } else setEvents([]);
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setServiceType(null); setTitle(""); setItemsText(""); setInstructions(""); setBudget("");
    setPickupLocation(""); setPickupContactName(""); setPickupContactPhone("");
    setPurchaseRequired(true); setAddressId(""); setReference(null);
  };

  const chooseReference = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Photo permission needed", "Allow photo access to attach an optional reference image."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.82 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const size = asset.fileSize ?? 0;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) || size > 5 * 1024 * 1024) {
      Alert.alert("Unsupported image", "Choose a JPG, PNG or WebP image no larger than 5 MB."); return;
    }
    setReference({ uri: asset.uri, mimeType, fileName: asset.fileName ?? "reference.jpg", size });
  };

  const submit = async () => {
    if (!serviceType) return;
    const cleanTitle = title.trim();
    const lines = itemsText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 30);
    if (cleanTitle.length < 2 || !lines.length || !addressId) {
      Alert.alert("Complete the request", "Enter a title, at least one item or package, and choose a delivery address."); return;
    }
    if (serviceType === "pasugo" && pickupLocation.trim().length < 3) {
      Alert.alert("Pickup location required", "Enter the shop, address or pickup point."); return;
    }
    const parsedBudget = budget.trim() ? Number(budget) : null;
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 1 || parsedBudget > 50000)) {
      Alert.alert("Invalid budget", "Enter a budget between ₱1 and ₱50,000."); return;
    }
    if (serviceType === "pasugo" && purchaseRequired && parsedBudget === null) {
      Alert.alert("Budget required", "Enter the maximum purchase budget when the rider must buy an item."); return;
    }
    const address = addresses.find(item => item.id === addressId);
    if (!address) { Alert.alert("Choose an address", "Select one of your saved delivery addresses."); return; }
    const parsedItems = lines.map(line => {
      const match = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
      return { quantity: match ? Math.min(99, Number(match[1])) : 1, name: (match ? match[2] : line).slice(0, 140) };
    });
    if (parsedItems.some(item => !item.name || item.quantity < 1)) { Alert.alert("Check your items", "Each item needs a valid name and quantity."); return; }
    const municipality = Array.isArray(address.municipalities) ? address.municipalities[0] : address.municipalities;
    const addressSnapshot = {
      label: address.label, recipient_name: address.recipient_name, recipient_phone: address.recipient_phone,
      address_line: address.address_line, landmark: address.landmark, municipality: municipality?.name ?? null
    };
    setSubmitting(true);
    try {
      const { data: created, error } = await supabase.from("service_requests").insert({
        service_type: serviceType, customer_id: userId, status: "pending_review",
        request_title: cleanTitle.slice(0, 140), instructions: instructions.trim().slice(0, 1000),
        items: parsedItems, purchase_required: serviceType === "papalit" || purchaseRequired,
        pickup_location: serviceType === "pasugo" ? pickupLocation.trim().slice(0, 300) : null,
        pickup_contact_name: serviceType === "pasugo" ? pickupContactName.trim().slice(0, 120) || null : null,
        pickup_contact_phone: serviceType === "pasugo" ? pickupContactPhone.trim().slice(0, 40) || null : null,
        delivery_address_snapshot: addressSnapshot, municipality_id: address.municipality_id, customer_budget: parsedBudget
      }).select("id,request_number").single();
      if (error || !created) throw error ?? new Error("The request was not created.");
      const { error: eventError } = await supabase.from("service_request_events").insert({
        service_request_id: created.id, actor_user_id: userId, actor_role: "customer",
        event_type: "request_submitted", note: serviceType === "papalit" ? "Papalit request submitted." : "Pasugo request submitted."
      });
      if (eventError) Alert.alert("Request saved", "Your request " + created.request_number + " was submitted, but the activity timeline could not be updated. You do not need to submit it again.");
      if (reference) {
        const ext = reference.mimeType === "image/png" ? "png" : reference.mimeType === "image/webp" ? "webp" : "jpg";
        const path = created.id + "/reference." + ext;
        const bytes = await new File(reference.uri).arrayBuffer();
        const { error: uploadError } = await supabase.storage.from("service-request-evidence").upload(path, bytes, { contentType: reference.mimeType, upsert: false });
        if (uploadError) {
          Alert.alert("Request saved without photo", "Your request " + created.request_number + " was submitted, but the reference photo could not be uploaded. You do not need to submit the request again.");
        } else {
          const { error: attachError } = await supabase.rpc("customer_attach_service_request_reference", { p_request_id: created.id, p_path: path });
          if (attachError) Alert.alert("Request saved without photo", "Your request " + created.request_number + " was submitted, but the photo could not be attached. You do not need to submit it again.");
        }
      }
      Alert.alert("Request submitted", created.request_number + " is now awaiting Admin review. The estimate and fees will be confirmed before rider dispatch.");
      resetForm();
      await load(true);
    } catch (error: any) {
      Alert.alert("Unable to submit request", error?.message ?? "Please try again.");
    } finally { setSubmitting(false); }
  };

  const field = (label: string, value: string, onChangeText: (value: string) => void, placeholder: string, options: any = {}) => (
    <View style={s.fieldWrap}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#99a3b2" style={[s.input, options.multiline && s.multiline]} multiline={Boolean(options.multiline)} keyboardType={options.keyboardType ?? "default"} maxLength={options.maxLength ?? 1000} /></View>
  );

  return <View style={s.root}>
    <View style={s.header}><TouchableOpacity onPress={serviceType ? resetForm : onBack} style={s.back}><Text style={s.backText}>‹  {serviceType ? "Services" : "Back"}</Text></TouchableOpacity><Text style={s.headerTitle}>Papalit & Pasugo</Text><TouchableOpacity onPress={() => { setRefreshing(true); void load(true); }}><Text style={s.refresh}>Refresh</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={s.content}>
      {serviceType ? <>
        <View style={s.hero}><Text style={s.heroEyebrow}>SUGOMATE {serviceType === "papalit" ? "PERSONAL SHOPPING" : "PICKUP SERVICE"}</Text><Text style={s.heroTitle}>{serviceType === "papalit" ? "Papalit" : "Pasugo"}</Text><Text style={s.heroCopy}>{serviceType === "papalit" ? "Tell us what to buy and a rider will purchase and deliver it." : "Tell us where an item should be picked up and where it should be delivered."}</Text></View>
        {field("Request title", title, setTitle, serviceType === "papalit" ? "e.g. Grocery shopping" : "e.g. Pick up my parcel", {maxLength:140})}
        {serviceType === "pasugo" && <View style={s.fieldWrap}><Text style={s.label}>Request type</Text><View style={s.choiceRow}><TouchableOpacity onPress={() => setPurchaseRequired(false)} style={[s.choice, !purchaseRequired && s.choiceActive]}><Text style={[s.choiceText, !purchaseRequired && s.choiceTextActive]}>Pick up item</Text></TouchableOpacity><TouchableOpacity onPress={() => setPurchaseRequired(true)} style={[s.choice, purchaseRequired && s.choiceActive]}><Text style={[s.choiceText, purchaseRequired && s.choiceTextActive]}>Buy an item</Text></TouchableOpacity></View></View>}
        {field(serviceType === "papalit" ? "Shopping list · one item per line" : "Item / package details", itemsText, setItemsText, serviceType === "papalit" ? "2 x 1L fresh milk\n1 x loaf of bread\n3 x canned tuna" : "Describe the item, quantity, package or identifying details", {multiline:true,maxLength:3000})}
        {serviceType === "pasugo" && field("Pickup location", pickupLocation, setPickupLocation, "Shop name, address or pickup point", {maxLength:300})}
        {serviceType === "pasugo" && field("Pickup contact name (optional)", pickupContactName, setPickupContactName, "Contact person", {maxLength:120})}
        {serviceType === "pasugo" && field("Pickup contact phone (optional)", pickupContactPhone, setPickupContactPhone, "Mobile number", {keyboardType:"phone-pad",maxLength:40})}
        {field("Instructions / preferred brands", instructions, setInstructions, "Add details, alternatives, pickup instructions…", {multiline:true,maxLength:1000})}
        {field(serviceType === "pasugo" ? "Maximum purchase budget (required if buying)" : "Maximum shopping budget (optional)", budget, setBudget, "Enter amount in pesos", {keyboardType:"decimal-pad",maxLength:12})}
        <View style={s.fieldWrap}><Text style={s.label}>Reference photo (optional)</Text><TouchableOpacity onPress={() => void chooseReference()} style={s.photoButton}><Text style={s.photoText}>{reference ? "Change reference photo" : "＋ Choose photo · JPG, PNG or WebP · Max 5 MB"}</Text></TouchableOpacity>{reference&&<View style={s.photoPreview}><Image source={{uri:reference.uri}} style={s.previewImage}/><View style={{flex:1}}><Text style={s.photoText} numberOfLines={2}>{reference.fileName}</Text><TouchableOpacity onPress={() => setReference(null)}><Text style={s.removePhoto}>Remove photo</Text></TouchableOpacity></View></View>}</View>
        <View style={s.fieldWrap}><Text style={s.label}>Deliver to</Text>{addresses.length ? addresses.map(address=><TouchableOpacity key={address.id} onPress={() => setAddressId(address.id)} style={[s.addressOption,addressId===address.id&&s.addressSelected]}><Text style={s.addressTitle}>{addressId===address.id?"● ":"○ "}{address.label}</Text><Text style={s.addressCopy}>{address.address_line}{address.landmark?" · "+address.landmark:""}</Text><Text style={s.addressCopy}>{address.recipient_name} · {address.recipient_phone}</Text></TouchableOpacity>) : <Text style={s.note}>No saved address found. Add one from More → Manage saved addresses before submitting.</Text>}</View>
        <View style={s.noteBox}><Text style={s.note}>{serviceType==="papalit"?"Admin reviews your shopping list and confirms the purchase budget, delivery fee and service fee.":"Pasugo supports item purchases and pickups only; no bill payments or unrelated errands in this release. Admin confirms charges before dispatch."} The rider is paid directly by you in cash or GCash at delivery. This is separate from merchant orders.</Text></View>
        <TouchableOpacity disabled={submitting||!addresses.length} onPress={() => void submit()} style={[s.submit, (submitting||!addresses.length)&&s.disabled]}>{submitting?<ActivityIndicator color="#fff"/>:<Text style={s.submitText}>Submit {serviceType==="papalit"?"Papalit":"Pasugo"} request</Text>}</TouchableOpacity>
      </> : <>
        <View style={s.hero}><Text style={s.heroEyebrow}>SUGOMATE EXTRA SERVICES</Text><Text style={s.heroTitle}>What can we help with?</Text><Text style={s.heroCopy}>These requests are handled separately from your normal store orders.</Text></View>
        <TouchableOpacity style={s.serviceCard} onPress={() => setServiceType("papalit")}><Text style={s.serviceEmoji}>🛍️</Text><View style={{flex:1}}><Text style={s.serviceTitle}>Papalit</Text><Text style={s.serviceCopy}>We buy the items on your list and deliver them to you.</Text></View><Text style={s.arrow}>›</Text></TouchableOpacity>
        <TouchableOpacity style={s.serviceCard} onPress={() => setServiceType("pasugo")}><Text style={s.serviceEmoji}>📦</Text><View style={{flex:1}}><Text style={s.serviceTitle}>Pasugo</Text><Text style={s.serviceCopy}>We pick up an item or package from a location and bring it to you.</Text></View><Text style={s.arrow}>›</Text></TouchableOpacity>
        <Text style={s.sectionTitle}>My service requests</Text>
        {loading?<ActivityIndicator color={ORANGE} style={{marginTop:20}}/>:requests.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No requests yet</Text><Text style={s.emptyCopy}>Your Papalit and Pasugo activity will appear here.</Text></View>:requests.map(request=>{
          const requestEvents=events.filter(event=>event.service_request_id===request.id);
          const address=request.delivery_address_snapshot??{};
          const list=Array.isArray(request.items)?request.items:[];
          return <View key={request.id} style={s.requestCard}>
            <View style={s.requestTop}><View style={{flex:1}}><Text style={s.requestType}>{request.service_type.toUpperCase()}</Text><Text style={s.requestTitle}>{request.request_title}</Text><Text style={s.requestMeta}>{request.request_number} · {new Date(request.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</Text></View><Text style={s.status}>{statusLabel[request.status]??eventLabel(request.status)}</Text></View>
            {request.pickup_location?<Text style={s.requestCopy}>Pickup: {request.pickup_location}</Text>:null}
            <Text style={s.requestCopy}>Deliver to: {address.address_line??"Saved address"}</Text>
            {list.map((item:any,index:number)=><Text key={index} style={s.itemLine}>{item.quantity??1} × {item.name??"Item"}</Text>)}
            <View style={s.amountGrid}>{[["Budget",request.customer_budget],["Approved purchase",request.approved_purchase_budget],["Actual purchase",request.actual_purchase_amount],["Delivery fee",request.delivery_fee],["Service fee",request.service_fee],["Quoted total",request.quoted_total]].map(([label,value])=><View key={String(label)} style={s.amountCell}><Text style={s.amountLabel}>{label}</Text><Text style={s.amountValue}>{value===null?"Pending":money(value as number|string)}</Text></View>)}</View>
            <Text style={s.requestCopy}>Payment: {request.payment_status.toUpperCase()}{request.payment_status==="paid"?" · "+String(request.payment_method??"").toUpperCase()+" · "+money(request.amount_collected):" · Pay your rider directly at delivery"}</Text>
            {requestEvents.length>0&&<View style={s.timeline}><Text style={s.timelineTitle}>Request activity</Text>{requestEvents.map(event=><View key={event.id} style={s.eventRow}><View style={s.dot}/><View style={{flex:1}}><Text style={s.eventName}>{eventLabel(event.event_type)}</Text>{event.note?<Text style={s.eventNote}>{event.note}</Text>:null}<Text style={s.eventDate}>{new Date(event.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</Text></View></View>)}</View>}
          </View>;
        })}
        <Text style={s.disclaimer}>Admin review and rider dispatch are managed through the existing SUGOMATE service-request workflow. Status and payment information shown here comes from the shared backend.</Text>
      </>}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
 root:{flex:1,backgroundColor:BG},header:{minHeight:58,backgroundColor:"#fff",paddingHorizontal:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#f0e3d9"},back:{paddingVertical:10,paddingRight:8},backText:{fontSize:12,fontWeight:"900",color:NAVY},headerTitle:{fontSize:15,fontWeight:"900",color:NAVY},refresh:{fontSize:11,fontWeight:"800",color:"#c95522"},
 content:{padding:15,paddingBottom:35},hero:{backgroundColor:NAVY,borderRadius:20,padding:18,marginBottom:17},heroEyebrow:{fontSize:9,fontWeight:"900",letterSpacing:1.5,color:"#ffd39d"},heroTitle:{fontSize:23,fontWeight:"900",color:"#fff",marginTop:5},heroCopy:{fontSize:11,lineHeight:17,color:"#e4edf8",marginTop:6},
 serviceCard:{flexDirection:"row",alignItems:"center",gap:12,padding:15,backgroundColor:"#fff",borderRadius:17,borderWidth:1,borderColor:"#ffead8",marginBottom:10},serviceEmoji:{fontSize:30},serviceTitle:{fontSize:15,fontWeight:"900",color:NAVY},serviceCopy:{fontSize:10,lineHeight:15,color:"#738096",marginTop:3},arrow:{fontSize:25,color:ORANGE},
 sectionTitle:{fontSize:17,fontWeight:"900",color:NAVY,marginTop:18,marginBottom:10},empty:{backgroundColor:"#fff",padding:24,borderRadius:16,alignItems:"center",borderWidth:1,borderColor:"#ffead8"},emptyTitle:{fontSize:14,fontWeight:"900",color:NAVY},emptyCopy:{fontSize:11,color:"#738096",marginTop:5,textAlign:"center"},
 fieldWrap:{marginBottom:13},label:{fontSize:11,fontWeight:"900",color:NAVY,marginBottom:6},input:{backgroundColor:"#fff",borderWidth:1,borderColor:"#eadfd5",borderRadius:12,paddingHorizontal:12,paddingVertical:12,fontSize:13,color:NAVY},multiline:{minHeight:90,textAlignVertical:"top"},choiceRow:{flexDirection:"row",gap:8},choice:{flex:1,padding:12,borderRadius:12,borderWidth:1,borderColor:"#e5eaf0",backgroundColor:"#fff",alignItems:"center"},choiceActive:{backgroundColor:"#fff0e5",borderColor:ORANGE},choiceText:{fontSize:11,fontWeight:"800",color:"#526173"},choiceTextActive:{color:NAVY},
 photoButton:{padding:13,borderRadius:12,borderWidth:1,borderStyle:"dashed",borderColor:"#e6b985",backgroundColor:"#fff"},photoText:{fontSize:11,fontWeight:"700",color:NAVY},photoPreview:{flexDirection:"row",alignItems:"center",gap:10,marginTop:8,padding:9,backgroundColor:"#fff",borderRadius:12},previewImage:{width:58,height:58,borderRadius:9},removePhoto:{fontSize:10,color:"#c2410c",fontWeight:"900",marginTop:6},
 addressOption:{padding:12,borderWidth:1,borderColor:"#e5eaf0",backgroundColor:"#fff",borderRadius:12,marginBottom:7},addressSelected:{borderColor:ORANGE,backgroundColor:"#fff0e5"},addressTitle:{fontSize:12,fontWeight:"900",color:NAVY},addressCopy:{fontSize:10,color:"#738096",marginTop:4},noteBox:{backgroundColor:"#fff0df",padding:12,borderRadius:12,marginTop:2},note:{fontSize:10,lineHeight:16,color:"#76512d"},submit:{backgroundColor:ORANGE,borderRadius:25,padding:15,alignItems:"center",marginTop:15,minHeight:48,justifyContent:"center"},submitText:{fontSize:13,fontWeight:"900",color:"#fff"},disabled:{opacity:.55},
 requestCard:{backgroundColor:"#fff",borderWidth:1,borderColor:"#ffead8",borderRadius:17,padding:14,marginBottom:12},requestTop:{flexDirection:"row",justifyContent:"space-between",gap:8,marginBottom:8},requestType:{fontSize:9,fontWeight:"900",color:"#c95522",letterSpacing:1},requestTitle:{fontSize:14,fontWeight:"900",color:NAVY,marginTop:3},requestMeta:{fontSize:9,color:"#8995a7",marginTop:4},status:{fontSize:9,fontWeight:"900",color:NAVY,backgroundColor:"#fff0df",paddingHorizontal:9,paddingVertical:6,borderRadius:12,alignSelf:"flex-start",maxWidth:112},requestCopy:{fontSize:10,color:"#526173",marginTop:7},itemLine:{fontSize:10,color:NAVY,marginTop:5},amountGrid:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:10},amountCell:{width:"31%",backgroundColor:"#f8fafc",padding:8,borderRadius:9},amountLabel:{fontSize:8,color:"#8995a7"},amountValue:{fontSize:10,fontWeight:"900",color:NAVY,marginTop:3},timeline:{borderTopWidth:1,borderTopColor:"#edf0f3",marginTop:11,paddingTop:10},timelineTitle:{fontSize:10,fontWeight:"900",color:NAVY,marginBottom:8},eventRow:{flexDirection:"row",gap:8,marginBottom:9},dot:{width:7,height:7,borderRadius:4,backgroundColor:ORANGE,marginTop:4},eventName:{fontSize:10,fontWeight:"900",color:NAVY},eventNote:{fontSize:9,color:"#526173",marginTop:2},eventDate:{fontSize:8,color:"#8995a7",marginTop:2},disclaimer:{fontSize:9,color:"#8995a7",lineHeight:14,marginTop:7}
});
