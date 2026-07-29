# Publicação do Visual Review Portal

## Destino

O portal é publicado pelo GitHub Pages a partir da branch `main`:

`https://nicnariz.github.io/ff/`

O workflow está em `.github/workflows/deploy-visual-review.yml`.

## Modelo de segurança

O repositório `nicnariz/ff` é público e, por consequência, o portal também é público.
A publicação estática é estritamente somente leitura:

- não recebe nem armazena tokens;
- não grava aprovações;
- não expõe endpoint de promoção;
- não promove baselines;
- solicitações de decisão abrem uma issue no GitHub, exigindo autenticação;
- a promoção continua disponível apenas no executor autenticado e no processo formal QA → Product Owner.

Se o repositório for convertido para privado, GitHub Pages não deve ser tratado como controle
de acesso. Nesse cenário, interrompa o deploy público e migre para Cloudflare Pages com Access
ou outra hospedagem com autenticação obrigatória.

## Build local

```powershell
$env:VISUAL_REVIEW_BASE_PATH="/ff/"
npm --prefix apps/visual-review install
npm --prefix apps/visual-review run build
node apps/visual-review/scripts/verify-static.mjs
```

O build é gerado em `apps/visual-review/dist` e contém:

- aplicação React;
- `data/portal.json`;
- 168 capturas;
- mockups associados;
- `.nojekyll`.

## Atualização automática

Cada commit em `main` que altere o portal, as capturas, os mockups, os manifestos ou os arquivos
de aprovação executa:

1. instalação determinística com `pnpm`;
2. testes e typecheck do portal;
3. geração dos dados estáticos;
4. validação das 168 capturas;
5. upload do artefato;
6. deploy no GitHub Pages.

Também é possível iniciar manualmente o workflow `Deploy Visual Review Portal`.

## Aprovação

1. Abra a captura no portal.
2. Clique em **Solicitar revisão no GitHub**.
3. Autentique-se no GitHub.
4. Registre papel, decisão, hash e comentário.
5. O resultado deve ser aplicado a `approvals.json` pelo fluxo de revisão do repositório.
6. O commit em `main` republica automaticamente o estado.

Uma baseline nunca é promovida pelo site publicado.

## Configuração inicial do GitHub Pages

Em `Settings → Pages → Build and deployment`, selecione **GitHub Actions**.
O ambiente `github-pages` deve restringir implantação à branch `main`.

## Validação

Após o deploy:

1. abrir a URL em desktop;
2. confirmar 168 capturas;
3. testar busca e todos os filtros;
4. abrir mockup, captura e overlay;
5. repetir em viewport móvel;
6. confirmar que aprovação e promoção não executam chamadas mutáveis;
7. confirmar que a solicitação de revisão direciona ao GitHub autenticado.
