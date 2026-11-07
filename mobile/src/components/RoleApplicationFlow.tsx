import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "../lib/supabase";

type Role = "merchant" | "driver";
type Props = { role: Role; userId: string; onDone: () => void; onSignOut: () => void };
type Picked = { uri: string; mimeType: string; fileName: string; size: number };

const NAVY = "#102e57", ORANGE = "#ff8a00", RED = "#e95718";
const inputStyle = { marginTop: 12, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 13, borderWidth: 1, borderColor: "#e5eaf0", backgroundColor: "#fff", color: NAVY, fontSize: 14 } as const;

export default function RoleApplicationFlow({ role, userId, onDone, onSignOut }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [age, setAge] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [docs, setDocs] = useState<Record<string, Picked>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isDriver = role === "driver";
  const title = isDriver ? "Delivery partner application" : "Merchant application";

  async function pickDocument(key: string) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert("Photo access needed", "Allow photo access to attach your application document."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0], mimeType = asset.mimeType ?? "image/jpeg", size = asset.fileSize ?? new File(asset.uri).size;
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) { Alert.alert("Unsupported image", "Choose JPG, PNG or WebP."); return; }
      if (!size || size > 5 * 1024 * 1024) { Alert.alert("Image too large", "Each image must be no larger than 5 MB."); return; }
      setDocs(current => ({ ...current, [key]: { uri: asset.uri, mimeType, size, fileName: asset.fileName ?? key + ".jpg" } }));
    } catch (e: any) { Alert.alert("Unable to select image", e?.message ?? "Try again."); }
  }

  async function uploadDocument(key: string) {
    const doc = docs[key];
    if (!doc) return null;
    const ext = doc.mimeType === "image/png" ? "png" : doc.mimeType === "image/webp" ? "webp" : "jpg";
    const storageKey = key === "profile_photo" ? "profile" : key;
    const path = userId + "/" + storageKey + "-" + Date.now().toString(36) + "." + ext;
    const bytes = await new File(doc.uri).arrayBuffer();
    const { error } = await supabase.storage.from("driver-documents").upload(path, bytes, { contentType: doc.mimeType, upsert: false });
    if (error) throw error;
    return path;
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      if (isDriver) {
        const years = age.trim() ? Number(age) : null;
        if (!["Motorcycle", "Bicycle", "Car", "Other"].includes(vehicle)) throw new Error("Select your vehicle type.");
        if (years !== null && (!Number.isInteger(years) || years < 18 || years > 80)) throw new Error("Enter an age between 18 and 80.");
        const uploadedPaths: string[] = [];
        const [idPath, selfiePath, licensePath, profilePath] = await Promise.all([
          uploadDocument("id"), uploadDocument("selfie"), uploadDocument("license"), uploadDocument("profile_photo")
        ]);
        uploadedPaths.push(...[idPath, selfiePath, licensePath, profilePath].filter((path): path is string => Boolean(path)));
        const { error: insertError } = await supabase.from("driver_profiles").insert({
          user_id: userId, vehicle_type: vehicle, vehicle_plate: plate.trim() || null, age: years,
          address: address.trim() || null, status: "pending", id_storage_path: idPath,
          selfie_storage_path: selfiePath, license_storage_path: licensePath, profile_photo_path: null
        });
        if (insertError) {
          if (uploadedPaths.length) await supabase.storage.from("driver-documents").remove(uploadedPaths);
          throw insertError;
        }
        if (profilePath) {
          const { error: photoError } = await supabase.rpc("driver_update_profile_photo", { p_profile_photo_path: profilePath });
          if (photoError) {
            await supabase.storage.from("driver-documents").remove([profilePath]);
            throw photoError;
          }
        }
      } else {
        const cleanName = name.trim();
        const cleanSlug = (slug.trim() || cleanName).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (cleanName.length < 2 || cleanSlug.length < 3) throw new Error("Enter a business name and a store URL name of at least three characters.");
        const { data: merchant, error: merchantError } = await supabase.from("merchants").insert({
          owner_id: userId, name: cleanName, slug: cleanSlug, status: "pending",
          address: address.trim() || null, contact_phone: phone.trim() || null, description: description.trim() || null
        }).select("id").single();
        if (merchantError || !merchant) throw merchantError ?? new Error("Could not create your store application.");
        const { error: memberError } = await supabase.from("merchant_members").insert({ merchant_id: merchant.id, user_id: userId, member_role: "owner" });
        if (memberError) throw memberError;
      }
      Alert.alert("Application submitted", "Your application is now pending SUGOMATE Admin review. You will be notified when its status changes.");
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "We could not submit your application. Please review the details and try again.");
    } finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>SUGOMATE ONBOARDING</Text><Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{isDriver ? "Tell us about your vehicle and provide optional documents for Admin review. Your private ID images are not shown to customers." : "Tell us about your store. Your listing remains inactive until Admin approves the application."}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {isDriver ? <>
        <TextInput style={inputStyle} placeholder="Age (18–80, recommended)" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Text style={styles.fieldLabel}>Vehicle type</Text>
        <View style={styles.options}>{["Motorcycle", "Bicycle", "Car", "Other"].map(v => <TouchableOpacity key={v} onPress={() => setVehicle(v)} style={[styles.option, vehicle === v && styles.optionActive]}><Text style={[styles.optionText, vehicle === v && styles.optionTextActive]}>{v}</Text></TouchableOpacity>)}</View>
        <TextInput style={inputStyle} placeholder="Vehicle plate number (optional)" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
        <TextInput style={[inputStyle, { minHeight: 82 }]} placeholder="Home / base address (recommended)" value={address} onChangeText={setAddress} multiline />
        <Text style={styles.sectionTitle}>Customer-facing profile photo</Text><Text style={styles.help}>A clear face photo shown only to the customer assigned to your delivery.</Text>
        <TouchableOpacity style={styles.upload} onPress={() => pickDocument("profile_photo")}><Text style={styles.uploadText}>{docs.profile_photo ? "✓ Profile photo selected" : "Choose profile photo"}</Text></TouchableOpacity>
        <Text style={styles.sectionTitle}>Private verification documents (optional)</Text><Text style={styles.help}>These are stored in the private driver-documents bucket for Admin review only.</Text>
        {([["id", "Government ID"], ["selfie", "Selfie holding your ID"], ["license", "Driver's license"]] as const).map(([key, label]) => <TouchableOpacity key={key} style={styles.upload} onPress={() => pickDocument(key)}><Text style={styles.uploadText}>{docs[key] ? "✓ " + label + " selected" : "＋ " + label}</Text></TouchableOpacity>)}
      </> : <>
        <TextInput style={inputStyle} placeholder="Business / store name" value={name} onChangeText={v => { setName(v); if (!slug) setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} />
        <TextInput style={inputStyle} placeholder="Store URL name (e.g. juans-store)" value={slug} onChangeText={setSlug} autoCapitalize="none" />
        <TextInput style={[inputStyle, { minHeight: 82 }]} placeholder="Store address (street, barangay, municipality)" value={address} onChangeText={setAddress} multiline />
        <TextInput style={inputStyle} placeholder="Business contact phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={[inputStyle, { minHeight: 90 }]} placeholder="Short description of your store (optional)" value={description} onChangeText={setDescription} multiline />
      </>}
      <TouchableOpacity disabled={busy} onPress={submit} style={[styles.primary, busy && { opacity: .65 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit for Admin review</Text>}</TouchableOpacity>
      <TouchableOpacity onPress={onSignOut} style={styles.secondary}><Text style={styles.secondaryText}>Sign out</Text></TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
 safe: { flex: 1, backgroundColor: "#fff7ef" }, wrap: { padding: 22, paddingBottom: 38 }, eyebrow: { color: RED, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginTop: 14 },
 title: { color: NAVY, fontSize: 25, fontWeight: "900", marginTop: 8 }, subtitle: { color: "#738096", fontSize: 13, lineHeight: 19, marginTop: 8 },
 fieldLabel: { color: NAVY, fontWeight: "800", marginTop: 18 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
 option: { borderWidth: 1, borderColor: "#e5eaf0", borderRadius: 15, backgroundColor: "#fff", paddingVertical: 11, paddingHorizontal: 14 },
 optionActive: { backgroundColor: NAVY, borderColor: NAVY }, optionText: { color: NAVY, fontWeight: "800", fontSize: 12 }, optionTextActive: { color: "#fff" },
 sectionTitle: { color: NAVY, fontSize: 14, fontWeight: "900", marginTop: 22 }, help: { color: "#738096", fontSize: 11, lineHeight: 16, marginTop: 5 },
 upload: { marginTop: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#f0b46e", borderRadius: 13, padding: 14, backgroundColor: "#fff" }, uploadText: { color: NAVY, fontSize: 12, fontWeight: "800" },
 primary: { marginTop: 24, borderRadius: 15, backgroundColor: NAVY, padding: 16, alignItems: "center" }, primaryText: { color: "#fff", fontSize: 13, fontWeight: "900" },
 secondary: { padding: 15, alignItems: "center" }, secondaryText: { color: RED, fontWeight: "800" },
 error: { marginTop: 15, backgroundColor: "#fff0f0", color: "#b42318", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 17 }
});