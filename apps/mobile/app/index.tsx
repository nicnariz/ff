import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../src/services/auth';

export default function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(): Promise<void> { setLoading(true); try { await login(email, password); Alert.alert('Pronto!', 'Login realizado.'); } catch { Alert.alert('Não foi possível entrar', 'Confira seu e-mail e senha.'); } finally { setLoading(false); } }
  return <View style={styles.container}><Text style={styles.title}>Família Feliz</Text><Text style={styles.subtitle}>Organize as tarefas da família.</Text><TextInput style={styles.input} placeholder="E-mail" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /><TextInput style={styles.input} placeholder="Senha" secureTextEntry value={password} onChangeText={setPassword} /><Pressable style={styles.button} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}</Pressable><Text style={styles.link}>Criar conta</Text><Text style={styles.link}>Esqueci minha senha</Text></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F7F8FC' }, title: { color: '#25355A', fontSize: 32, fontWeight: '700' }, subtitle: { color: '#65708A', fontSize: 16, marginTop: 8, marginBottom: 36 }, input: { backgroundColor: '#fff', borderColor: '#D8DEEA', borderWidth: 1, borderRadius: 12, fontSize: 16, marginBottom: 12, padding: 15 }, button: { alignItems: 'center', backgroundColor: '#536DFE', borderRadius: 12, marginTop: 8, padding: 16 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, link: { color: '#4058CF', marginTop: 22, textAlign: 'center' } });
