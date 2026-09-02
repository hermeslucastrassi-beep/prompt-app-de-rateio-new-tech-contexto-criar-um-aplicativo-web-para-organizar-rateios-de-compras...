# Prompt App de Rateio New Tech Contexto Criar um aplicativo web para organizar rateios de compras...

# Prompt — App de Rateio "New Tech"

## Contexto

Criar um aplicativo web para organizar rateios de compras internacionais do grupo **New Tech**. Os produtos são comprados em lotes fixos de **10 unidades (viais/ampolas)**, e o app deve permitir que participantes se inscrevam nas listas de cada produto, escolhendo a quantidade de viais que desejam, até que lotes de 10 sejam fechados para compra.

## Funcionalidades gerais

### 1. Identificação do participante

- Ao se inscrever pela primeira vez, a pessoa preenche: **nome**, **e-mail**, **telefone** e cria um **PIN** (4 dígitos) para si.

- O **nome** é o que aparece publicamente na lista de inscritos.

- O **e-mail** não aparece na lista pública — serve só como identificador interno e para contato/recuperação.

- O PIN é usado depois para a própria pessoa poder excluir sua inscrição.

- Nome, e-mail e telefone ficam salvos localmente no navegador da pessoa, para prefill automático nas próximas inscrições (armazenamento pessoal, não visível a mais ninguém).

### 2. Página pública — Lista de produtos

- Lista todos os produtos cadastrados, cada um mostrando:

  - Nome do produto

  - Valor total do lote

  - Valor por vial (**valor total ÷ unidades por lote**, calculado automaticamente)

  - Progresso do lote atual (representado visualmente por uma "bandeja" de viais: preenchidos = confirmados/pendentes, vazios = disponíveis)

  - Quantos lotes já foram fechados

- Cada produto pode ter **mais de 10 inscritos no total** (fila); o sistema agrupa automaticamente as inscrições em lotes.

- Botão **"Inscrever-se"**:

  - Pessoa escolhe a **quantidade de viais** desejada.

  - Nome, telefone e quantidade ficam visíveis publicamente na lista daquele produto, junto com o status do pagamento.

- Cada inscrição tem botão de **excluir**, protegido pelo PIN da própria pessoa.

### 3. Status de pagamento

- Toda inscrição nasce como **"Aguardando pagamento"**.

- A pessoa paga via Pix (ou cartão, se disponível) e envia o comprovante pelo **WhatsApp cadastrado pelo administrador**.

- O **administrador confirma manualmente** no sistema, mudando o status para **"Confirmado"**.

- Prazo de pagamento configurável pelo administrador (padrão: **5 dias**).

### 4. Página de administrador

Acesso protegido por **senha única fixa de administrador**.

Três seções:

- **Cadastrar produto**: nome, valor total, unidades por lote (padrão 10, editável), valor por vial calculado automaticamente. Lista de produtos já cadastrados com opção de exclusão.

- **Resumo geral**: para cada produto, lista completa de inscritos (nome, e-mail, telefone, quantidade, valor devido, status). Botão para confirmar pagamento de cada inscrito, botão de acesso rápido ao WhatsApp da pessoa, botão para remover qualquer participante (sem precisar do PIN dele), e botão para fechar manualmente um lote quando completar as unidades necessárias.

- **Configurações**: chave Pix, link de pagamento por cartão (opcional), número de WhatsApp para recebimento de comprovantes, prazo de pagamento em dias, e opção de trocar a senha de administrador.

### 5. Pagamento

- **Pix**: chave cadastrada pelo administrador, com botão "copiar" para a pessoa colar no app do banco.

- **Cartão (opcional)**: link de checkout pronto de algum gateway (ex: Mercado Pago Checkout Pro), cadastrado pelo administrador.

## Regras de negócio importantes

- Valor por vial = valor total do lote ÷ unidades por lote (padrão 10).

- Lotes se formam a cada N viais reservados; a lista pode ter mais participantes do que cabem no lote atual, formando fila para o(s) próximo(s) lote(s).

- O fechamento de cada lote é **decidido manualmente pelo administrador**.

- Participantes não conseguem excluir a inscrição de outras pessoas — só a própria (via PIN) ou o admin (via senha de administrador).

- O nome do participante é público; o e-mail não é exibido na lista, apenas guardado para uso interno/contato.

## Publicação

O app foi desenvolvido como artefato HTML autocontido, usando armazenamento compartilhado (para produtos, inscrições e configurações, visíveis a todos) e armazenamento pessoal (para lembrar os dados de quem preenche, só no próprio navegador). Para funcionar de verdade fora do ambiente de desenvolvimento, precisa ser **publicado** (gerando um link público) — abrir o arquivo `.html` localmente, sem publicar, não mantém os dados salvos entre usuários.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18d8c285-c9bf-47cd-9cf4-c1ba0ae8edc0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
