# ADR-0020 — Kubernetes local, validação por fatia e DAST

Status: Aceito · 2026-11-12 · Revisa a ADR-0016 (a `ai-infra` era "só dev local"; hml/prd na AWS) e o desenho "um cluster por ambiente" do `ai-ops` · **ADR-0021:** sem namespace `dev` (onde a ADR diz `dev`, leia a última `main`); o review é aberto pelo botão da Fatia; o DAST sai do review, é ativo no `qa` e passivo em `hml` e produção · **ADR-0022:** o review é leve (preview estático de front; contrato e testes de API) e não sobe API e front reais juntos · **ADR-0025:** a NetworkPolicy isola os namespaces entre si e **não** limita o ZAP, que roda no runner, fora do cluster

Todos os ambientes passam a ser Kubernetes, em **dois clusters k3d locais**: `esteira-nao-prod` (namespaces `dev`, `qa`, `hml` e `review-*`) e `esteira-prd-local` (só produção). O isolamento entre `qa`, `hml` e `review-*` vem de namespace e **NetworkPolicy**; produção nunca divide cluster com o que sofre DAST. Produção é um **Destino** configurável: `local` agora, `aws` depois; trocar é mudar o Destino do Projeto na Esteira, sem mudar o pipeline. Nenhuma feature vai para a AWS no dia a dia.

**Motivo declarado:** o projeto é de uma pessoa e serve também para aprender Kubernetes. Manter cluster, operators, cert-manager e GitLab Agent só para validar features custa mais do que um `docker run` local, e esse custo é **assumido de propósito**. A complexidade que costuma justificar evitar isso (N MRs, N clusters, N pessoas) não existe aqui.

## Validação por fatia

- O **código da fatia** (`B2`, em minúsculo `b2` por causa do DNS) é o identificador que atravessa todo o CI/CD. Além de branch, commit, MR e `[Trait("Fatia", "B2")]` (que já existem), passa a nomear: namespace `review-b2`, GitLab environment `review/b2`, tag da imagem descartável `b2-<sha7>`, label `esteira/fatia=b2` nos objetos do cluster, o campo `fatia` em Deploy e Análise na Esteira, e as chaves de flag `Features:B2...` (ADR-0019).
- **Um namespace por fatia**, não por MR. API e front da mesma fatia ficam juntos. Se só um repositório tem a branch da fatia, o outro entra com o artefato atual de `dev` (a última `main`). O primeiro pipeline que chegar cria o namespace (idempotente). O job `fechar-fatia` do `template-ci` o destrói quando a última MR da fatia é mergeada ou fechada.
- O artefato do review é **descartável**, gerado no CI do MR. O oficial só nasce no merge na `main` (ADR-0018).

## DAST

O **OWASP ZAP roda como job determinístico** do pipeline contra o ambiente publicado. O agente `security` (ADR-0012) **só lê o relatório** e o converte no JSON de Análise. Quem **bloqueia** é a Política de segurança da Esteira, não o julgamento do agente.

| Onde | Varredura | Efeito |
|---|---|---|
| `review-<fatia>` | passiva | só avisa (ambiente DEV na Política) |
| `qa` | **ativa** | bloqueia crítica e alta, salvo Exceção |
| `hml` | passiva | bloqueia crítica e alta, salvo Exceção |
| produção | nenhuma | — |

Varredura ativa nunca em `hml` nem em produção. Uma NetworkPolicy limita o ZAP ao namespace alvo.

## Considered Options

- **Rodar a imagem do MR localmente com `docker run`** contra a `ai-infra` (mais barato): descartado só pelo motivo de aprendizado acima. Continua sendo a saída se o custo do cluster pesar.
- **Review app hospedado** (cluster, Ingress e DNS curingas fora da máquina): adiado para quando houver mais gente.
- **Um cluster k3d por ambiente (4)**: o desenho original do `ai-ops`. Pesa demais para uma máquina só.

## Consequences

- A ADR-0016 vale para banco e roles, mas "ai-infra = só dev local" deixa de ser verdade: `dev` também é Kubernetes.
- O `template-ci` precisa aceitar build em MR (hoje só constrói em tag), publicar `<fatia>-<sha7>` e limpar essas tags do registry.
- Pedidos para `ai-ops`/`ai-infra`: dois clusters, NetworkPolicy, ZAP, GitLab Agent em ambos. Lista em `pendencias-orchestration-ai.md`.
- Não medi a memória da máquina. Se não aguentar, voltar a menos ambientes simultâneos é mudar Destino, não pipeline.
