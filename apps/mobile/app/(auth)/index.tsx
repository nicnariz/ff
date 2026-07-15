import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '../../src/auth-store';
import { friendlyError } from '../../src/services/errors';
import { login } from '../../src/services/auth';
export default function LoginScreen(): JSX.Element {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [loading,setLoading]=useState(false); const signedIn=useAuthStore(s=>s.signedIn);
  async function submit(){if(!email.trim()||!password)return Alert.alert('Preencha e-mail e senha.');setLoading(true);try{await login(email.trim(),password);signedIn();router.replace('/');}catch(e){Alert.alert('Nao foi possivel entrar',friendlyError(e));}finally{setLoading(false);}}
  return <View style={s.page}><Text style={s.title}>Familia Feliz</Text><Text style={s.subtitle}>Organize as responsabilidades da familia.</Text><TextInput style={s.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/><TextInput style={s.input} placeholder="Senha" secureTextEntry value={password} onChangeText={setPassword}/><Pressable style={s.primary} disabled={loading} onPress={submit}>{loading?<ActivityIndicator color="#fff"/>:<Text style={s.primaryText}>Entrar</Text>}</Pressable></View>;
}
const s=StyleSheet.create({page:{backgroundColor:'#F7F8FC',flex:1,justifyContent:'center',padding:24},title:{color:'#20304F',fontSize:32,fontWeight:'700'},subtitle:{color:'#667085',fontSize:16,marginBottom:32,marginTop:8},input:{backgroundColor:'#fff',borderColor:'#CBD5E1',borderRadius:8,borderWidth:1,fontSize:16,marginBottom:12,padding:14},primary:{alignItems:'center',backgroundColor:'#285943',borderRadius:8,padding:15},primaryText:{color:'#fff',fontWeight:'700'}});
