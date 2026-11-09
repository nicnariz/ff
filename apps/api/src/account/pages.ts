// Páginas públicas exigidas pela Google Play: política de privacidade e pedido de exclusão de conta.
type Info = { controller: string; email: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const UPDATED = '9 de novembro de 2026';

function layout(title: string, body: string, script = '') {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Família Feliz</title>
<style>
  :root { --turquesa: #13B5A6; --marinho: #1E2A3A; --linho: #F7F3EC; --texto: #2B3442; --suave: #5B6576; --alerta: #B4472B; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--linho); color: var(--texto); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { background: var(--marinho); color: #fff; padding: 20px 20px 18px; }
  header .marca { font-weight: 700; letter-spacing: .2px; }
  header .marca span { color: var(--turquesa); }
  main { max-width: 720px; margin: 0 auto; padding: 24px 20px 64px; }
  h1 { font-size: 1.6rem; line-height: 1.25; color: var(--marinho); margin: 8px 0 4px; }
  h2 { font-size: 1.15rem; color: var(--marinho); margin: 32px 0 6px; }
  .atualizado { color: var(--suave); font-size: .9rem; margin: 0 0 20px; }
  a { color: #0B7F75; }
  ul { padding-left: 1.2rem; }
  li { margin: 4px 0; }
  .card { background: #fff; border-radius: 14px; padding: 20px; box-shadow: 0 1px 2px rgba(30,42,58,.08); }
  label { display: block; font-weight: 600; margin: 14px 0 6px; }
  input { width: 100%; font: inherit; padding: 12px 14px; border: 1.5px solid #CBD2DC; border-radius: 10px; background: #fff; }
  input:focus { outline: none; border-color: var(--turquesa); box-shadow: 0 0 0 3px rgba(19,181,166,.2); }
  .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; }
  .check input { width: auto; margin-top: 5px; }
  button { margin-top: 18px; width: 100%; font: inherit; font-weight: 700; padding: 13px; border: 0; border-radius: 10px; background: var(--alerta); color: #fff; cursor: pointer; }
  button[disabled] { opacity: .6; cursor: default; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 10px; display: none; }
  .msg.ok { display: block; background: #E3F6F3; color: #0B5E57; }
  .msg.erro { display: block; background: #FBE9E4; color: #8A3320; }
  footer { color: var(--suave); font-size: .85rem; margin-top: 40px; }
</style>
</head>
<body>
<header><div class="marca">Família <span>Feliz</span></div></header>
<main>
${body}
<footer>Família Feliz · <a href="/privacidade">Política de privacidade</a> · <a href="/excluir-conta">Excluir conta</a></footer>
</main>
${script}
</body>
</html>`;
}

function contato(info: Info) {
  return info.email
    ? `pelo e-mail <a href="mailto:${esc(info.email)}">${esc(info.email)}</a>`
    : 'pelos canais indicados na página do app na Google Play';
}

export function privacyPage(info: Info) {
  const quem = esc(info.controller);
  return layout(
    'Política de privacidade',
    `
<h1>Política de privacidade</h1>
<p class="atualizado">Última atualização: ${UPDATED}</p>

<p>O Família Feliz ajuda famílias a organizar rotinas, tarefas, combinados, recompensas e mesada. Esta política explica quais dados o app usa, para quê, com quem são compartilhados e como você pode exercer seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>

<h2>Quem é o responsável pelos dados</h2>
<p>O controlador dos dados é <strong>${quem}</strong>. Para dúvidas ou pedidos sobre seus dados, fale conosco ${contato(info)}.</p>

<h2>Quais dados coletamos</h2>
<ul>
  <li><strong>Conta:</strong> nome, e-mail e senha. A senha é guardada de forma irreversível (hash) e ninguém da equipe consegue lê-la.</li>
  <li><strong>Família:</strong> nome da família, participantes, papéis (administração, responsável, participante), apelidos e convites.</li>
  <li><strong>Uso do dia a dia:</strong> tarefas, ocorrências e comentários de conclusão ou revisão, pontos, conquistas, metas, valores da família, recompensas e pedidos, cofrinhos, configurações e períodos de mesada (valores combinados pela família), notificações dentro do app e preferências de aviso.</li>
  <li><strong>Dados técnicos mínimos:</strong> registros de acesso ao servidor (data, hora e endereço IP), mantidos por segurança e pelo prazo exigido pelo Marco Civil da Internet.</li>
</ul>
<p>O app <strong>não</strong> usa localização, câmera, microfone, contatos, identificador de publicidade, anúncios, ferramentas de análise de comportamento nem SDKs de terceiros para rastreamento.</p>

<h2>Para que usamos</h2>
<ul>
  <li>Criar e manter sua conta e o acesso à sua família (execução do serviço que você pediu).</li>
  <li>Mostrar as mesmas informações para todas as pessoas da família, em qualquer aparelho.</li>
  <li>Aplicar as regras combinadas pela família (aprovações, pontos, mesada, metas e avisos).</li>
  <li>Proteger o serviço contra abusos e cumprir obrigações legais.</li>
</ul>
<p>Não vendemos dados e não usamos dados para publicidade.</p>

<h2>Crianças e adolescentes</h2>
<p>O app foi pensado para ser usado pela família, com a participação de crianças e adolescentes <strong>sob supervisão de um responsável</strong>. A conta de quem tem menos de 18 anos deve ser criada com o consentimento e o acompanhamento de pai, mãe ou responsável legal, que pode pedir a qualquer momento o acesso, a correção ou a exclusão dos dados (art. 14 da LGPD). Coletamos apenas o necessário para a família usar o app e não há chat aberto com desconhecidos: cada família só vê as próprias informações.</p>

<h2>Quem vê seus dados</h2>
<ul>
  <li><strong>Sua família:</strong> participantes da mesma família veem tarefas, pontos, recompensas, metas e a linha do tempo da família. Notificações e preferências de aviso são só suas. A mesada de todos aparece apenas para quem administra a família. O seu e-mail não é mostrado às outras pessoas.</li>
  <li><strong>Fornecedores de infraestrutura</strong>, que tratam os dados apenas para operar o serviço: Railway (servidor do app, nos Estados Unidos) e Neon (banco de dados, em São Paulo). Para a hospedagem nos Estados Unidos há transferência internacional de dados, feita com as garantias exigidas pela LGPD.</li>
  <li><strong>Autoridades</strong>, somente quando houver obrigação legal ou ordem judicial.</li>
</ul>

<h2>Segurança</h2>
<p>Toda comunicação entre o app e o servidor é criptografada (HTTPS). Senhas são guardadas com hash e o acesso ao banco de dados é restrito.</p>

<h2>Por quanto tempo guardamos</h2>
<p>Enquanto a conta existir. Ao excluir a conta, apagamos seus dados pessoais (veja abaixo). Registros de acesso são mantidos por até 6 meses, como exige a lei.</p>

<h2>Seus direitos</h2>
<p>Você pode pedir confirmação de tratamento, acesso, correção, portabilidade, informação sobre compartilhamento, revogação do consentimento e exclusão dos dados ${contato(info)}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

<h2 id="exclusao">Como excluir sua conta e seus dados</h2>
<ul>
  <li><strong>No app:</strong> Ajustes → Excluir minha conta.</li>
  <li><strong>Pela web:</strong> na página <a href="/excluir-conta">Excluir conta</a>, com seu e-mail e senha.</li>
</ul>
<p>Ao excluir, apagamos na hora: nome, e-mail, senha, apelidos, suas notificações e preferências, sua linha do tempo e suas configurações de mesada. Se você era a única pessoa da família, a família inteira e todos os registros dela são apagados. Se a família continua com outras pessoas, os lançamentos já feitos (pontos, pedidos, períodos de mesada) permanecem no histórico da família sem o seu nome, aparecendo como “Conta excluída”, para que as contas dos outros participantes continuem corretas.</p>

<h2>Mudanças nesta política</h2>
<p>Se esta política mudar, a data acima será atualizada e, se a mudança for importante, avisaremos no app.</p>
`,
  );
}

export function deletionPage(info: Info) {
  return layout(
    'Excluir conta',
    `
<h1>Excluir sua conta do Família Feliz</h1>
<p class="atualizado">Você também pode excluir pelo app: Ajustes → Excluir minha conta.</p>

<div class="card">
  <p><strong>O que acontece:</strong></p>
  <ul>
    <li>Seu nome, e-mail, senha, apelidos, notificações, preferências, linha do tempo e configurações de mesada são apagados na hora.</li>
    <li>Se você é a única pessoa da sua família, a família e todos os registros dela também são apagados.</li>
    <li>Se a família continua com outras pessoas, os lançamentos já feitos ficam no histórico dela como “Conta excluída”. Se você era a única pessoa na administração, a pessoa responsável mais antiga passa a administrar.</li>
    <li>Não dá para desfazer.</li>
  </ul>

  <form id="f" autocomplete="on">
    <label for="email">E-mail da conta</label>
    <input id="email" name="email" type="email" required autocomplete="email">
    <label for="senha">Senha</label>
    <input id="senha" name="senha" type="password" required autocomplete="current-password">
    <label class="check"><input id="ok" type="checkbox" required> Entendo que a exclusão é definitiva.</label>
    <button id="b" type="submit">Excluir minha conta</button>
    <div id="m" class="msg" role="status" aria-live="polite"></div>
  </form>
</div>

<p style="margin-top:20px">Esqueceu a senha ou prefere pedir por mensagem? Fale conosco ${contato(info)}, informando o e-mail da conta. Respondemos em até 15 dias.</p>
`,
    `<script>
(function () {
  var f = document.getElementById('f'), b = document.getElementById('b'), m = document.getElementById('m');
  var erros = {
    INVALID_CREDENTIALS: 'E-mail ou senha não conferem.',
    TOO_MANY_ATTEMPTS: 'Muitas tentativas. Espere 15 minutos e tente de novo.'
  };
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    m.className = 'msg'; b.disabled = true; b.textContent = 'Excluindo…';
    fetch('/api/v1/account/delete-by-credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.email.value, password: f.senha.value })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (x) {
      if (x.ok) {
        f.reset(); f.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        m.className = 'msg ok'; m.textContent = 'Pronto: sua conta foi excluída. Se o app estiver aberto em algum aparelho, ele vai pedir para entrar de novo.';
        b.textContent = 'Conta excluída';
      } else {
        var code = x.j && x.j.code;
        m.className = 'msg erro';
        m.textContent = (x.j && typeof x.j.message === 'string' && code !== 'INVALID_CREDENTIALS' && x.j.message) || erros[code] || 'Não foi possível excluir agora. Confira os dados e tente de novo.';
        b.disabled = false; b.textContent = 'Excluir minha conta';
      }
    }).catch(function () {
      m.className = 'msg erro'; m.textContent = 'Sem conexão com o servidor. Tente de novo.';
      b.disabled = false; b.textContent = 'Excluir minha conta';
    });
  });
})();
</script>`,
  );
}
