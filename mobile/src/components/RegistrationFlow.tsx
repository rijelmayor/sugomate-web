import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

type Role = "customer" | "merchant" | "driver";
type Props = { onBack: () => void };

const NAVY = "#102e57";
const ORANGE = "#ff8a00";
const RED = "#e95718";

export default function RegistrationFlow({ onBack }: Props) {
  const [role, setRole] = useState<Role>("customer");
  const [step, setStep] = useState<"details" | "verify" | "complete">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(userId: string) {
    const response = await fetch("https://sugomate.com/api/mobile/registration/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, phone }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to send the verification code.");
  }

  async function createAccount() {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8 || !phone.trim()) {
      setError("Complete all fields. Use a valid email, Philippine mobile number and password of at least 8 characters.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { emailRedirectTo: "https://sugomate.com/auth/callback?next=%2Fdashboard", data: { display_name: name.trim(), phone: phone.trim(), intended_role: role } },
      });
      if (signupError || !data.user) throw new Error(signupError?.message ?? "Unable to create your account.");
      if (data.user.identities?.length === 0) throw new Error("This email is already registered. Please sign in instead.");
      await sendCode(data.user.id);
      setStep("verify");
      setNotice("We sent a six-digit code to your mobile number. It expires in five minutes.");
    } catch (e: any) {
      setError(e?.message ?? "Registration failed. Please try again.");
    } finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the six-digit code."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("https://sugomate.com/api/mobile/registration/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Verification failed.");
      setStep("complete");
      setNotice("Your mobile number is verified. Check your email to confirm your account, then sign in to SUGOMATE.");
    } catch (e: any) { setError(e?.message ?? "Verification failed."); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authError || !data.user) throw new Error("Please finish email confirmation or register again before requesting another code.");
      await sendCode(data.user.id);
      setNotice("A new verification code has been sent.");
    } catch (e: any) { setError(e?.message ?? "Unable to resend the code."); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹  Back to sign in</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>JOIN SUGOMATE</Text>
      <Text style={styles.title}>{step === "verify" ? "Verify your number" : step === "complete" ? "You're almost there!" : "Create your account"}</Text>
      <Text style={styles.subtitle}>{step === "details" ? "Choose the account type you want to register." : step === "verify" ? "Enter the code sent to your Philippine mobile number." : "Your mobile verification is complete."}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {step === "details" ? <>
        <View style={styles.roles}>{(["customer", "merchant", "driver"] as Role[]).map(item => <TouchableOpacity key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleActive]}><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === "driver" ? "Delivery partner" : item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}</View>
        <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder="Mobile number (09XXXXXXXXX)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity disabled={busy} onPress={createAccount} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue to mobile verification</Text>}</TouchableOpacity>
      </> : step === "verify" ? <>
        <TextInput style={[styles.input, styles.code]} placeholder="000000" value={code} onChangeText={v => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
        <TouchableOpacity disabled={busy} onPress={verifyCode} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify mobile number</Text>}</TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={resendCode} style={styles.secondary}><Text style={styles.secondaryText}>Resend verification code</Text></TouchableOpacity>
      </> : <TouchableOpacity onPress={onBack} style={styles.primary}><Text style={styles.primaryText}>Return to sign in</Text></TouchableOpacity>}
      <Text style={styles.footnote}>By continuing, you agree to use accurate account details. Merchant and delivery partner applications remain subject to SUGOMATE review and approval.</Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ef" }, wrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  back: { paddingVertical: 12 }, backText: { color: RED, fontWeight: "800" },
  eyebrow: { marginTop: 20, color: RED, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: NAVY, fontSize: 27, fontWeight: "900" }, subtitle: { marginTop: 7, color: "#738096", fontSize: 13, lineHeight: 19 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22 }, role: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: "#e5eaf0", backgroundColor: "#fff" },
  roleActive: { backgroundColor: NAVY, borderColor: NAVY }, roleText: { color: NAVY, fontSize: 11, fontWeight: "800" }, roleTextActive: { color: "#fff" },
  input: { marginTop: 13, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 13, borderWidth: 1, borderColor: "#e5eaf0", backgroundColor: "#fff", color: NAVY, fontSize: 14 },
  code: { textAlign: "center", fontSize: 24, letterSpacing: 8, marginTop: 25 }, primary: { marginTop: 18, padding: 15, borderRadius: 15, backgroundColor: ORANGE, alignItems: "center" }, disabled: { opacity: .6 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 13 }, secondary: { padding: 14, alignItems: "center" }, secondaryText: { color: RED, fontWeight: "800" },
  error: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: "#fff0f0", color: "#b42318", fontSize: 12, lineHeight: 17 },
  notice: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: "#eaf8f0", color: "#176b43", fontSize: 12, lineHeight: 17 },
  footnote: { marginTop: 25, color: "#8995a7", fontSize: 10, lineHeight: 16, textAlign: "center" },
});
