# Discord --- Documento Completo de Funcionalidades e Funcionamento

> Documento de referência funcional sobre o Discord, sua estrutura,
> principais recursos, regras de funcionamento e fluxos de usuário. Pode
> ser utilizado como base de estudo, levantamento de requisitos,
> benchmarking ou planejamento de uma plataforma de comunicação
> semelhante.

------------------------------------------------------------------------

## 1. Visão Geral

O **Discord** é uma plataforma de comunicação em tempo real organizada
principalmente em comunidades chamadas **servidores**.

A plataforma combina:

-   mensagens privadas;
-   mensagens em grupo;
-   comunidades;
-   canais de texto;
-   canais de voz;
-   chamadas de vídeo;
-   compartilhamento de tela;
-   fóruns;
-   threads;
-   eventos;
-   cargos;
-   permissões;
-   moderação;
-   bots e aplicativos;
-   integrações;
-   notificações;
-   personalização de perfil;
-   recursos pagos;
-   descoberta e participação em comunidades.

O usuário possui uma conta global e pode participar de diferentes
servidores utilizando a mesma conta.

------------------------------------------------------------------------

# 2. Estrutura Geral da Plataforma

Uma representação simplificada da hierarquia é:

``` text
Discord
├── Conta do usuário
│   ├── Perfil
│   ├── Amigos
│   ├── Mensagens privadas
│   ├── Grupos privados
│   ├── Configurações
│   └── Aplicativos/conexões
│
├── Servidores
│   ├── Membros
│   ├── Categorias
│   │   ├── Canais de texto
│   │   ├── Canais de voz
│   │   ├── Fóruns
│   │   └── outros tipos de canais
│   ├── Cargos
│   ├── Permissões
│   ├── Eventos
│   ├── Moderação
│   ├── Integrações
│   └── Aplicativos/Bots
│
└── Comunicação
    ├── Mensagens
    ├── Threads
    ├── Reações
    ├── Voz
    ├── Vídeo
    ├── Streaming
    └── Arquivos
```

------------------------------------------------------------------------

# 3. Conta do Usuário

## 3.1 Cadastro

O usuário cria uma conta para utilizar a plataforma.

A conta pode possuir informações como:

-   nome de exibição;
-   nome de usuário;
-   avatar;
-   banner;
-   biografia;
-   status;
-   informações de autenticação;
-   e-mail;
-   telefone, quando aplicável;
-   conexões com serviços externos.

## 3.2 Login

O sistema permite autenticação da conta e manutenção de sessão em
diferentes dispositivos.

Recursos de segurança podem incluir:

-   senha;
-   autenticação em dois fatores;
-   códigos de recuperação;
-   gerenciamento de dispositivos/sessões;
-   confirmação por e-mail;
-   confirmação por telefone em determinados cenários.

## 3.3 Perfil

O perfil representa a identidade do usuário.

Pode conter:

-   avatar;
-   nome;
-   username;
-   descrição;
-   banner;
-   status;
-   badges;
-   conexões;
-   informações adicionais de personalização.

Dependendo dos recursos disponíveis, o usuário também pode personalizar
sua apresentação de maneira diferente em determinados servidores.

------------------------------------------------------------------------

# 4. Status do Usuário

O Discord apresenta informações de presença.

Exemplos:

-   Online;
-   Ausente;
-   Não Perturbe;
-   Invisível/Offline.

Também podem existir status personalizados.

Exemplo:

``` text
🎮 Jogando
📚 Estudando
💻 Trabalhando
```

Aplicativos e atividades conectadas também podem exibir informações de
atividade, dependendo das configurações de privacidade.

------------------------------------------------------------------------

# 5. Amigos

O sistema possui relacionamento entre usuários através da lista de
amigos.

## 5.1 Adicionar amigo

Um usuário pode enviar solicitação de amizade.

Fluxo:

``` text
Usuário A
   ↓
Envia solicitação
   ↓
Usuário B recebe
   ↓
Aceitar / Ignorar
   ↓
Amizade criada
```

## 5.2 Lista de amigos

Pode apresentar categorias como:

-   disponíveis;
-   todos;
-   pendentes;
-   bloqueados.

## 5.3 Bloqueio

O usuário pode bloquear outra conta.

O bloqueio limita determinadas formas de interação entre as contas.

------------------------------------------------------------------------

# 6. Mensagens Diretas --- DM

DM significa **Direct Message**.

Permite comunicação privada entre usuários.

Recursos comuns:

-   texto;
-   emojis;
-   GIFs;
-   stickers;
-   imagens;
-   vídeos;
-   arquivos;
-   links;
-   reações;
-   respostas;
-   edição;
-   exclusão;
-   chamadas de voz;
-   chamadas de vídeo;
-   compartilhamento de tela.

------------------------------------------------------------------------

# 7. Grupos Privados

Além de conversas individuais, usuários podem criar grupos privados.

Um grupo pode permitir:

-   vários participantes;
-   mensagens;
-   chamadas;
-   compartilhamento de arquivos;
-   personalização básica do grupo;
-   gerenciamento de participantes.

Não possui necessariamente toda a estrutura administrativa de um
servidor.

------------------------------------------------------------------------

# 8. Servidores

O servidor é uma das principais estruturas do Discord.

Um servidor funciona como uma comunidade ou espaço organizado.

Exemplos:

``` text
Empresa
Faculdade
Equipe de desenvolvimento
Grupo de amigos
Comunidade de jogo
Projeto
Curso
Suporte
Clã
Comunidade pública
```

------------------------------------------------------------------------

# 9. Criar Servidor

O usuário pode criar um servidor.

Fluxo conceitual:

``` text
Criar servidor
     ↓
Escolher configuração/template
     ↓
Definir nome
     ↓
Adicionar imagem
     ↓
Servidor criado
     ↓
Configurar canais
     ↓
Configurar cargos
     ↓
Configurar permissões
     ↓
Convidar membros
```

O criador normalmente assume a propriedade inicial do servidor.

------------------------------------------------------------------------

# 10. Propriedade do Servidor

Um servidor possui um proprietário.

O proprietário possui autoridade administrativa máxima sobre o servidor
e pode realizar ações de gerenciamento de alto nível.

Em cenários suportados, a propriedade pode ser transferida para outro
membro.

------------------------------------------------------------------------

# 11. Convites

Membros autorizados podem gerar convites.

Um convite direciona outro usuário para entrada no servidor ou em
determinado contexto de canal.

Pode haver configurações relacionadas a:

-   validade;
-   quantidade de usos;
-   membro temporário;
-   responsável pela criação.

Exemplo conceitual:

``` text
Servidor
   ↓
Gerar convite
   ↓
Link/código
   ↓
Usuário acessa
   ↓
Visualiza entrada
   ↓
Aceita convite
   ↓
Entra no servidor
```

------------------------------------------------------------------------

# 12. Categorias

Categorias são utilizadas para organizar canais.

Exemplo:

``` text
📌 INFORMAÇÕES
   # regras
   # anúncios
   # novidades

💬 COMUNIDADE
   # geral
   # memes
   # jogos

🔊 VOZ
   🔊 Geral
   🔊 Jogos
   🔊 Música
```

Categorias também podem participar da lógica de permissões.

------------------------------------------------------------------------

# 13. Canais

Servidores são divididos em canais.

Os tipos e recursos disponíveis podem variar conforme configuração e
evolução do produto.

Principais conceitos incluem:

-   canais de texto;
-   canais de voz;
-   canais de anúncio em contextos compatíveis;
-   fóruns;
-   canais associados a recursos de comunidade.

------------------------------------------------------------------------

# 14. Canal de Texto

É utilizado para comunicação escrita.

Exemplo:

``` text
# geral
```

Possíveis funcionalidades:

-   enviar mensagens;
-   responder mensagens;
-   mencionar usuários;
-   mencionar cargos;
-   reações;
-   anexos;
-   links;
-   GIFs;
-   stickers;
-   emojis;
-   mensagens fixadas;
-   threads;
-   busca;
-   edição;
-   exclusão;
-   comandos de aplicativos.

------------------------------------------------------------------------

# 15. Mensagens

Uma mensagem pode possuir:

``` text
ID
Autor
Canal
Servidor/contexto
Conteúdo
Data/hora
Anexos
Reações
Referência de resposta
Informações de edição
```

## 15.1 Enviar mensagem

Fluxo:

``` text
Usuário abre canal
      ↓
Sistema verifica permissão
      ↓
Usuário escreve
      ↓
Envia
      ↓
Mensagem é publicada
      ↓
Demais usuários recebem atualização
```

------------------------------------------------------------------------

# 16. Editar Mensagem

O autor pode editar uma mensagem quando permitido.

O sistema mantém a indicação de que a mensagem foi editada.

------------------------------------------------------------------------

# 17. Excluir Mensagem

O próprio usuário pode remover suas mensagens dentro das regras da
plataforma.

Moderadores com permissões adequadas também podem remover mensagens de
outros usuários em servidores.

------------------------------------------------------------------------

# 18. Responder Mensagem

Uma resposta cria uma referência entre mensagens.

Exemplo:

``` text
João:
Qual horário começa?

Maria respondeu a João:
Às 20h.
```

Isso mantém o contexto da conversa.

------------------------------------------------------------------------

# 19. Reações

Usuários podem reagir utilizando emojis.

Exemplo:

``` text
Mensagem
👍 15
❤️ 7
😂 3
```

Uma reação normalmente registra:

``` text
Mensagem
Emoji
Usuário
```

------------------------------------------------------------------------

# 20. Emojis

Existem emojis padrão e, em servidores, podem existir emojis
personalizados.

Administradores podem gerenciar os recursos personalizados quando o
servidor possui suporte/capacidade para isso.

------------------------------------------------------------------------

# 21. Stickers

Stickers são elementos visuais utilizados em mensagens.

Podem existir stickers disponibilizados pela própria plataforma e
recursos personalizados associados a servidores.

------------------------------------------------------------------------

# 22. GIFs

A interface permite pesquisar e enviar GIFs através dos recursos
disponíveis na plataforma.

------------------------------------------------------------------------

# 23. Upload de Arquivos

Usuários podem compartilhar arquivos conforme suas permissões e os
limites aplicáveis à conta/plano.

Exemplos:

-   imagens;
-   vídeos;
-   PDFs;
-   documentos;
-   arquivos compactados;
-   outros formatos permitidos.

------------------------------------------------------------------------

# 24. Links e Embeds

Links podem gerar pré-visualizações.

Exemplo:

``` text
Título
Descrição
Imagem
Site
```

O comportamento depende do endereço e das configurações de
exibição/segurança.

------------------------------------------------------------------------

# 25. Menções

## Usuário

``` text
@usuario
```

Notifica ou destaca determinado usuário conforme suas configurações.

## Cargo

``` text
@Moderadores
```

Pode mencionar membros de um cargo quando a configuração permitir.

## Todos

Servidores podem possuir mecanismos de menção ampla, sujeitos a
permissões e configurações.

------------------------------------------------------------------------

# 26. Mensagens Fixadas

Mensagens importantes podem ser fixadas em canais quando o usuário
possui permissão.

São úteis para:

-   regras;
-   comunicados;
-   links;
-   informações importantes;
-   decisões;
-   documentação rápida.

------------------------------------------------------------------------

# 27. Threads

Threads são conversas derivadas de um canal ou mensagem.

Exemplo:

``` text
# desenvolvimento

Mensagem:
Precisamos discutir o novo login.

└── Thread: Novo Login
    ├── mensagem
    ├── mensagem
    └── mensagem
```

Isso evita que discussões específicas ocupem o canal principal.

------------------------------------------------------------------------

# 28. Fóruns

Canais de fórum são estruturados em tópicos/posts.

Exemplo:

``` text
Fórum: Suporte

[Problema no Login]
[Erro no Pagamento]
[Dúvida sobre cadastro]
```

Cada publicação funciona como uma discussão própria.

Pode haver:

-   título;
-   conteúdo;
-   tags;
-   respostas;
-   pesquisa;
-   organização por atividade.

------------------------------------------------------------------------

# 29. Tags de Fórum

Administradores podem definir tags para classificar publicações.

Exemplo:

``` text
BUG
DÚVIDA
RESOLVIDO
SUGESTÃO
URGENTE
```

------------------------------------------------------------------------

# 30. Canais de Voz

Canais de voz permitem comunicação em tempo real.

Diferentemente de uma chamada tradicional, o membro pode entrar e sair
do canal conforme desejar, desde que possua acesso.

Possíveis recursos:

-   áudio;
-   vídeo;
-   compartilhamento de tela;
-   controle de volume individual;
-   silenciar;
-   ensurdecer;
-   gerenciamento de participantes.

------------------------------------------------------------------------

# 31. Microfone

O usuário pode:

-   ativar/desativar microfone;
-   escolher dispositivo de entrada;
-   configurar sensibilidade;
-   utilizar recursos de processamento disponíveis;
-   testar entrada.

------------------------------------------------------------------------

# 32. Áudio de Outros Usuários

O usuário pode controlar localmente o volume de outros participantes.

Exemplo:

``` text
João: 100%
Maria: 60%
Pedro: 120%
```

Esse ajuste é individual e não necessariamente altera o áudio recebido
pelos demais participantes.

------------------------------------------------------------------------

# 33. Silenciar

Existem diferentes conceitos.

### Auto-silenciamento

O próprio usuário desativa sua transmissão de voz.

### Silenciamento por moderação

Moderadores autorizados podem controlar membros dentro de contextos de
voz conforme as permissões disponíveis.

------------------------------------------------------------------------

# 34. Ensurdecer

Ao ensurdecer, o usuário deixa de ouvir o áudio do canal e também pode
ter seu microfone afetado conforme o comportamento da aplicação.

------------------------------------------------------------------------

# 35. Vídeo

Participantes podem utilizar câmera em chamadas/canais compatíveis.

Pode haver:

-   câmera;
-   seleção de dispositivo;
-   visualização em grade;
-   foco em participante;
-   compartilhamento simultâneo de conteúdo conforme suporte da
    plataforma.

------------------------------------------------------------------------

# 36. Compartilhamento de Tela

O usuário pode transmitir sua tela ou aplicações compatíveis.

Fluxo:

``` text
Entrar em chamada/canal
       ↓
Compartilhar tela
       ↓
Selecionar tela/aplicação
       ↓
Configurar transmissão
       ↓
Iniciar
```

Outros participantes podem assistir à transmissão.

------------------------------------------------------------------------

# 37. Streaming

O Discord possui recursos de transmissão de aplicativos/jogos/tela
dentro de chamadas e canais de voz.

Características e limites de qualidade podem variar conforme plano e
recursos disponíveis.

------------------------------------------------------------------------

# 38. Cargos --- Roles

Cargos são essenciais para organização e controle de acesso.

Exemplo:

``` text
👑 Administrador
🛡️ Moderador
💻 Desenvolvedor
🎮 Jogador
👤 Membro
```

Um usuário pode possuir vários cargos.

------------------------------------------------------------------------

# 39. Hierarquia de Cargos

Os cargos possuem uma ordem.

Exemplo:

``` text
Administrador
    ↓
Moderador
    ↓
VIP
    ↓
Membro
```

A posição do cargo influencia determinadas ações administrativas.

Um moderador, por exemplo, pode não conseguir administrar alguém cujo
cargo esteja acima do seu.

------------------------------------------------------------------------

# 40. Cargo Padrão

Servidores possuem uma base de permissões aplicada aos membros,
tradicionalmente representada pelo contexto `@everyone`.

Depois, cargos adicionais podem conceder ou restringir capacidades.

------------------------------------------------------------------------

# 41. Permissões

O sistema de permissões é granular.

Exemplos de capacidades:

### Servidor

-   administrar servidor;
-   administrar cargos;
-   administrar canais;
-   administrar apelidos;
-   visualizar logs/auditoria conforme recurso disponível.

### Membros

-   expulsar;
-   banir;
-   moderar;
-   alterar apelidos conforme permissão.

### Texto

-   visualizar canal;
-   enviar mensagens;
-   administrar mensagens;
-   anexar arquivos;
-   adicionar reações;
-   utilizar emojis/stickers externos conforme disponibilidade;
-   criar ou participar de threads;
-   mencionar determinados grupos.

### Voz

-   conectar;
-   falar;
-   transmitir;
-   usar vídeo;
-   silenciar membros;
-   mover membros;
-   controlar determinados recursos de voz.

------------------------------------------------------------------------

# 42. Permissões por Canal

Um canal pode sobrescrever permissões gerais.

Exemplo:

``` text
# administracao

@everyone
❌ visualizar

Moderador
✅ visualizar
✅ enviar mensagem

Administrador
✅ visualizar
✅ enviar mensagem
✅ administrar
```

------------------------------------------------------------------------

# 43. Lógica Conceitual de Permissão

De maneira simplificada, o sistema considera:

``` text
Permissões base
+
Cargos
+
Sobrescritas da categoria
+
Sobrescritas do canal
=
Permissão efetiva
```

A implementação real possui regras de precedência que devem ser
respeitadas.

------------------------------------------------------------------------

# 44. Administrador

A permissão administrativa concede acesso muito amplo ao servidor.

Deve ser concedida apenas a usuários confiáveis.

------------------------------------------------------------------------

# 45. Moderação

Servidores podem possuir ferramentas para controlar comportamento e
acesso.

Ações comuns:

-   advertência por processo interno/bot;
-   timeout;
-   expulsão;
-   banimento;
-   remoção de mensagens;
-   restrição de canais;
-   filtros automáticos;
-   revisão de logs.

------------------------------------------------------------------------

# 46. Timeout

O timeout restringe temporariamente determinadas interações de um
membro.

Fluxo:

``` text
Moderador
   ↓
Seleciona membro
   ↓
Aplicar timeout
   ↓
Define período
   ↓
Usuário fica temporariamente restrito
```

------------------------------------------------------------------------

# 47. Kick

Kick remove o usuário do servidor.

Conceitualmente:

``` text
Usuário removido
      ↓
Não permanece como membro
      ↓
Pode voltar posteriormente caso possua um convite válido e não exista outra restrição
```

------------------------------------------------------------------------

# 48. Ban

Banimento impede a permanência/retorno normal da conta ao servidor
enquanto o ban estiver ativo.

Administradores/moderadores autorizados podem gerenciar a lista de
banimentos.

------------------------------------------------------------------------

# 49. AutoMod

Servidores compatíveis podem utilizar automação de moderação.

Exemplos de objetivos:

-   bloquear termos;
-   controlar spam;
-   limitar menções abusivas;
-   detectar padrões configurados;
-   gerar alertas para moderadores.

Fluxo conceitual:

``` text
Mensagem
   ↓
Regras automáticas
   ↓
Existe violação?
   ├── Não → publicar
   └── Sim → executar ação configurada
```

------------------------------------------------------------------------

# 50. Logs de Auditoria

A auditoria registra determinadas ações administrativas.

Exemplos:

``` text
Moderador X
removeu membro Y

Administrador A
alterou canal B

Moderador C
removeu mensagem

Administrador D
alterou cargo
```

É fundamental para rastreabilidade e segurança administrativa.

------------------------------------------------------------------------

# 51. Regras do Servidor

Servidores podem estabelecer regras de comunidade.

Exemplo:

``` text
1. Respeitar membros.
2. Não enviar spam.
3. Não divulgar conteúdo proibido.
4. Utilizar canais corretamente.
5. Seguir as políticas da plataforma.
```

Servidores com recursos de comunidade podem utilizar mecanismos
estruturados de entrada e regras.

------------------------------------------------------------------------

# 52. Onboarding de Servidor

Servidores podem configurar experiências para orientar novos membros.

Objetivos:

-   apresentar comunidade;
-   identificar interesses;
-   recomendar canais;
-   atribuir experiências/cargos conforme configuração;
-   reduzir confusão inicial.

Exemplo:

``` text
Entrou no servidor
       ↓
Conhecer regras
       ↓
Selecionar interesses
       ↓
Receber recomendações
       ↓
Acessar canais relevantes
```

------------------------------------------------------------------------

# 53. Eventos

Servidores podem criar eventos.

Exemplos:

-   reunião;
-   campeonato;
-   live;
-   aula;
-   sessão de jogo;
-   apresentação.

Informações típicas:

``` text
Nome
Descrição
Data
Horário
Local/canal
Imagem
Interessados
```

------------------------------------------------------------------------

# 54. Notificações

O Discord possui sistema configurável de notificações.

Um usuário pode receber notificações relacionadas a:

-   mensagens;
-   menções;
-   respostas;
-   DMs;
-   chamadas;
-   eventos;
-   atividades relevantes conforme configurações.

------------------------------------------------------------------------

# 55. Configurações de Notificação por Servidor

O usuário pode ajustar notificações por servidor e canal.

Exemplos conceituais:

``` text
Todas as mensagens
Somente menções
Configurações reduzidas
Silenciar servidor
Silenciar canal
```

Também podem existir exceções específicas por canal.

------------------------------------------------------------------------

# 56. Caixa de Entrada e Menções

A interface pode reunir menções e outras mensagens relevantes para
facilitar o acompanhamento de atividades ocorridas enquanto o usuário
estava ausente.

------------------------------------------------------------------------

# 57. Busca

O Discord permite pesquisar mensagens e conteúdos.

Filtros podem considerar aspectos como:

-   usuário;
-   canal;
-   período;
-   conteúdo;
-   anexos;
-   menções;
-   outros operadores disponíveis na interface.

Exemplo conceitual:

``` text
from:usuario
in:canal
has:file
```

------------------------------------------------------------------------

# 58. Aplicativos e Bots

Bots/aplicativos são integrações que adicionam funcionalidades.

Exemplos:

-   moderação;
-   música, quando compatível com as regras e APIs;
-   jogos;
-   tickets;
-   suporte;
-   enquetes;
-   automações;
-   integração com serviços;
-   estatísticas;
-   comandos personalizados.

------------------------------------------------------------------------

# 59. Comandos de Aplicativos

Aplicativos podem disponibilizar comandos integrados.

Exemplo:

``` text
/help
/poll
/ticket
/profile
```

O usuário seleciona o comando e fornece os parâmetros necessários.

------------------------------------------------------------------------

# 60. Permissões de Bots

Bots/aplicativos precisam de permissões apropriadas.

Exemplos:

``` text
Visualizar canal
Enviar mensagens
Gerenciar mensagens
Gerenciar cargos
Conectar em voz
```

Deve ser aplicado o princípio de menor privilégio: conceder somente as
permissões necessárias.

------------------------------------------------------------------------

# 61. Integrações

Servidores e contas podem integrar serviços externos conforme suporte da
plataforma.

As integrações podem sincronizar informações, publicar conteúdo ou
disponibilizar funcionalidades adicionais.

------------------------------------------------------------------------

# 62. Webhooks

Webhooks permitem que sistemas externos publiquem conteúdo
automaticamente em canais configurados.

Exemplo:

``` text
GitHub
   ↓
Novo commit
   ↓
Webhook
   ↓
Canal Discord
   ↓
Mensagem automática
```

São úteis para:

-   CI/CD;
-   monitoramento;
-   alertas;
-   sistemas internos;
-   notificações automatizadas.

------------------------------------------------------------------------

# 63. Comunidades

Servidores podem ser configurados com recursos voltados a comunidades
maiores.

Isso pode adicionar funcionalidades administrativas, de segurança,
descoberta e comunicação.

------------------------------------------------------------------------

# 64. Canais de Anúncio

Em contextos de comunidade compatíveis, canais podem ser utilizados para
publicação de anúncios que outros servidores podem acompanhar por
mecanismos próprios da plataforma.

------------------------------------------------------------------------

# 65. Descoberta de Servidores

Alguns servidores públicos elegíveis podem aparecer em mecanismos de
descoberta.

Usuários podem procurar comunidades por interesses.

------------------------------------------------------------------------

# 66. Nitro

O Discord oferece planos pagos associados à conta.

Dependendo do plano vigente, benefícios podem incluir recursos como:

-   personalização adicional;
-   limites maiores;
-   qualidade de streaming superior;
-   utilização ampliada de emojis/stickers;
-   recursos adicionais de perfil;
-   benefícios relacionados a servidores.

Os benefícios específicos podem mudar ao longo do tempo.

------------------------------------------------------------------------

# 67. Boost de Servidor

Usuários podem aplicar benefícios/boosts em servidores elegíveis.

A quantidade de boosts pode contribuir para desbloquear benefícios
coletivos do servidor.

Exemplos de benefícios possíveis:

-   melhorias de áudio;
-   limites maiores;
-   personalização;
-   recursos visuais;
-   vantagens adicionais de comunidade.

------------------------------------------------------------------------

# 68. Configurações do Usuário

A aplicação possui uma área extensa de configurações.

Categorias conceituais:

``` text
Minha conta
Perfis
Privacidade
Segurança
Dispositivos
Conexões
Aplicativos autorizados
Voz e vídeo
Texto e imagens
Acessibilidade
Notificações
Atalhos
Idioma
Aparência
Assinaturas
Cobrança
```

A nomenclatura e organização podem variar conforme versão/plataforma.

------------------------------------------------------------------------

# 69. Aparência

Usuários podem personalizar elementos da experiência, como tema e opções
visuais disponíveis.

------------------------------------------------------------------------

# 70. Acessibilidade

Recursos de acessibilidade podem incluir configurações relacionadas a:

-   movimento/animações;
-   contraste;
-   tamanho de fonte;
-   navegação;
-   experiência visual;
-   outros recursos assistivos disponíveis na plataforma.

------------------------------------------------------------------------

# 71. Voz e Vídeo --- Configurações

Possíveis opções:

``` text
Dispositivo de entrada
Dispositivo de saída
Volume
Teste de microfone
Sensibilidade
Câmera
Processamento de voz
Supressão de ruído
```

------------------------------------------------------------------------

# 72. Privacidade

O usuário pode controlar aspectos de interação.

Exemplos:

-   quem pode enviar solicitações de amizade;
-   mensagens privadas relacionadas a membros de servidores;
-   bloqueios;
-   uso de dados e personalização conforme opções disponíveis;
-   conexões exibidas;
-   atividade exibida.

------------------------------------------------------------------------

# 73. Segurança

Recursos importantes incluem:

-   autenticação;
-   2FA;
-   verificação;
-   gerenciamento de sessões;
-   alertas;
-   políticas contra abuso;
-   ferramentas de denúncia;
-   moderação;
-   filtros;
-   controle de aplicativos autorizados.

------------------------------------------------------------------------

# 74. Denúncias

Usuários podem denunciar conteúdos ou comportamentos que violem regras
da plataforma.

Exemplos:

-   mensagens;
-   usuários;
-   spam;
-   assédio;
-   conteúdo proibido;
-   golpes.

A plataforma pode analisar denúncias conforme seus processos de Trust &
Safety.

------------------------------------------------------------------------

# 75. Aplicativos Autorizados

Usuários podem conceder acesso a aplicações de terceiros.

É importante permitir:

``` text
Visualizar aplicativos
Ver permissões concedidas
Revogar autorização
```

------------------------------------------------------------------------

# 76. Multi-plataforma

O Discord pode ser utilizado em diferentes ambientes, incluindo:

-   navegador;
-   desktop;
-   dispositivos móveis;
-   integrações/plataformas compatíveis.

A conta mantém dados sincronizados através do backend.

------------------------------------------------------------------------

# 77. Sincronização em Tempo Real

Uma das características centrais é a atualização rápida entre clientes.

Exemplo:

``` text
Usuário envia mensagem
       ↓
Servidor recebe
       ↓
Persiste/processa
       ↓
Distribui evento
       ↓
Clientes conectados recebem
       ↓
Interface atualiza
```

------------------------------------------------------------------------

# 78. Conceito de Gateway/Eventos em Tempo Real

Em uma arquitetura semelhante, clientes mantêm conexão persistente para
receber eventos.

Exemplos:

``` text
MESSAGE_CREATE
MESSAGE_UPDATE
MESSAGE_DELETE

CHANNEL_CREATE
CHANNEL_UPDATE

MEMBER_JOIN
MEMBER_UPDATE

PRESENCE_UPDATE

VOICE_STATE_UPDATE
```

Esses eventos mantêm a interface sincronizada.

------------------------------------------------------------------------

# 79. Arquitetura Conceitual

Uma plataforma semelhante pode ser estruturada em:

``` text
CLIENTES
├── Web
├── Desktop
└── Mobile
      ↓
API / Gateway
      ↓
SERVIÇOS
├── Auth
├── Users
├── Servers
├── Channels
├── Messages
├── Permissions
├── Notifications
├── Voice
├── Media
├── Search
├── Moderation
└── Billing
      ↓
DADOS / INFRA
├── Banco relacional/distribuído
├── Cache
├── Object Storage
├── CDN
├── Search Engine
└── Event/Message Bus
```

------------------------------------------------------------------------

# 80. Modelo Conceitual de Dados

## User

``` text
id
username
display_name
email
password_hash
avatar
banner
bio
status
created_at
```

## Server / Guild

``` text
id
name
owner_id
icon
description
created_at
```

## ServerMember

``` text
server_id
user_id
nickname
joined_at
status
```

## Channel

``` text
id
server_id
category_id
name
type
position
created_at
```

## Message

``` text
id
channel_id
author_id
content
reply_to
created_at
updated_at
```

## Role

``` text
id
server_id
name
position
permissions
```

## MemberRole

``` text
member_id
role_id
```

## Reaction

``` text
message_id
user_id
emoji
```

## Attachment

``` text
id
message_id
url
filename
content_type
size
```

------------------------------------------------------------------------

# 81. Relacionamentos Principais

``` text
USER
  │
  ├──< FRIENDSHIP >── USER
  │
  ├──< SERVER_MEMBER >── SERVER
  │                         │
  │                         ├── CHANNEL
  │                         │      │
  │                         │      └── MESSAGE
  │                         │
  │                         └── ROLE
  │
  └── DIRECT_MESSAGE
```

------------------------------------------------------------------------

# 82. Fluxo de Entrada em Servidor

``` text
Usuário recebe convite
        ↓
Abre convite
        ↓
Sistema valida convite
        ↓
Usuário confirma entrada
        ↓
Sistema cria associação de membro
        ↓
Regras/onboarding quando aplicável
        ↓
Cargos/permissões são calculados
        ↓
Canais permitidos aparecem
```

------------------------------------------------------------------------

# 83. Fluxo de Envio de Mensagem

``` text
Usuário
   ↓
Seleciona canal
   ↓
Possui View Channel?
   ↓
Possui Send Messages?
   ↓
Escreve mensagem
   ↓
Backend valida
   ↓
Moderação/AutoMod
   ↓
Persistência
   ↓
Evento em tempo real
   ↓
Clientes recebem
   ↓
Notificações são calculadas
```

------------------------------------------------------------------------

# 84. Fluxo de Permissão

``` text
Usuário solicita recurso
       ↓
Identificar servidor
       ↓
Identificar membro
       ↓
Carregar cargos
       ↓
Calcular permissões base
       ↓
Aplicar regras administrativas
       ↓
Aplicar overrides relevantes
       ↓
Permitir / Negar
```

------------------------------------------------------------------------

# 85. Fluxo de Voz

``` text
Usuário entra no canal
        ↓
Verificar permissão CONNECT
        ↓
Conectar à infraestrutura de voz
        ↓
Negociar sessão
        ↓
Capturar microfone
        ↓
Codificar áudio
        ↓
Transmitir pacotes
        ↓
Participantes recebem
        ↓
Decodificar/reproduzir
```

------------------------------------------------------------------------

# 86. Fluxo de Notificação

``` text
Nova mensagem
      ↓
Quem possui acesso ao canal?
      ↓
Quem está mencionado?
      ↓
Configuração do servidor
      ↓
Configuração do canal
      ↓
Estado/presença do usuário
      ↓
Regras de notificação
      ↓
Enviar push/desktop/in-app quando aplicável
```

------------------------------------------------------------------------

# 87. Fluxo de Moderação

``` text
Conteúdo enviado
      ↓
Validações
      ↓
AutoMod
      ↓
Conteúdo permitido?
   ├── SIM → publicar
   └── NÃO
         ↓
       bloquear
         ↓
       registrar evento
         ↓
       alertar moderação, quando configurado
```

------------------------------------------------------------------------

# 88. Fluxo de Bot

``` text
Usuário
   ↓
Executa comando
   ↓
Discord/API
   ↓
Aplicativo recebe interação
   ↓
Aplicativo processa
   ↓
Responde
   ↓
Resposta exibida no Discord
```

------------------------------------------------------------------------

# 89. Estrutura de Administração de Servidor

Uma área administrativa de uma plataforma semelhante deveria
centralizar:

``` text
Visão geral
Cargos
Permissões
Canais
Emojis
Stickers
Membros
Convites
Banimentos
AutoMod
Auditoria
Integrações
Webhooks
Aplicativos
Comunidade
Onboarding
Segurança
Notificações administrativas
```

------------------------------------------------------------------------

# 90. Recursos Importantes para uma Plataforma Inspirada no Discord

## MVP

Uma primeira versão poderia possuir:

1.  cadastro/login;
2.  perfil;
3.  criação de servidor;
4.  convite;
5.  membros;
6.  categorias;
7.  canais de texto;
8.  mensagens em tempo real;
9.  respostas;
10. reações;
11. cargos;
12. permissões;
13. notificações;
14. moderação básica;
15. mensagens privadas.

## Segunda fase

Adicionar:

-   canais de voz;
-   vídeo;
-   compartilhamento de tela;
-   threads;
-   fóruns;
-   upload;
-   busca;
-   eventos;
-   bots;
-   webhooks;
-   AutoMod.

## Fase avançada

Adicionar:

-   sistema completo de comunidade;
-   descoberta;
-   monetização;
-   assinaturas;
-   benefícios de servidor;
-   marketplace/ecossistema de aplicativos;
-   analytics;
-   moderação avançada;
-   infraestrutura global de mídia;
-   escalabilidade distribuída.

------------------------------------------------------------------------

# 91. Requisitos Não Funcionais

Uma plataforma desse tipo exige atenção especial a:

## Performance

Mensagens precisam aparecer rapidamente.

## Escalabilidade

O sistema deve suportar grande volume de:

``` text
usuários
servidores
canais
mensagens
conexões simultâneas
áudio
vídeo
arquivos
eventos
```

## Disponibilidade

Serviços críticos devem possuir alta disponibilidade.

## Segurança

Dados e sessões precisam ser protegidos.

## Privacidade

Informações privadas devem respeitar controles de acesso.

## Auditoria

Ações administrativas importantes devem ser rastreáveis.

## Consistência

Cargos, canais e permissões devem apresentar comportamento previsível
entre dispositivos.

------------------------------------------------------------------------

# 92. Casos de Uso Principais

### UC01 --- Criar conta

**Ator:** Usuário

**Objetivo:** acessar a plataforma.

### UC02 --- Criar servidor

**Ator:** Usuário autenticado

**Objetivo:** criar uma comunidade.

### UC03 --- Entrar em servidor

**Ator:** Usuário

**Pré-condição:** possuir acesso/convite quando necessário.

### UC04 --- Criar canal

**Ator:** Administrador autorizado

**Objetivo:** organizar comunicação.

### UC05 --- Enviar mensagem

**Ator:** Membro

**Pré-condição:** possuir permissão.

### UC06 --- Criar cargo

**Ator:** Administrador autorizado

**Objetivo:** organizar membros e permissões.

### UC07 --- Moderar membro

**Ator:** Moderador

**Ações possíveis:** timeout, kick, ban e outras ações autorizadas.

### UC08 --- Entrar em voz

**Ator:** Membro

**Pré-condição:** possuir permissão.

### UC09 --- Enviar DM

**Ator:** Usuário

**Objetivo:** comunicação privada.

### UC10 --- Instalar aplicativo

**Ator:** Usuário/administrador autorizado

**Objetivo:** adicionar funcionalidades externas.

------------------------------------------------------------------------

# 93. Matriz Simplificada de Permissões

  Função                                  Membro        Moderador        Administrador   Dono
  ----------------------------- ---------------- ---------------- -------------------- ------
  Ler canais permitidos                       ✅               ✅                   ✅     ✅
  Enviar mensagens permitidas                 ✅               ✅                   ✅     ✅
  Reagir                                      ✅               ✅                   ✅     ✅
  Entrar em voz                   Conforme canal   Conforme canal                   ✅     ✅
  Gerenciar mensagens                         ❌               ✅                   ✅     ✅
  Timeout                                     ❌   Conforme cargo                   ✅     ✅
  Kick                                        ❌   Conforme cargo                   ✅     ✅
  Ban                                         ❌   Conforme cargo                   ✅     ✅
  Gerenciar canais                            ❌         Opcional                   ✅     ✅
  Gerenciar cargos                            ❌         Limitado                   ✅     ✅
  Administrar servidor                        ❌               ❌   Conforme permissão     ✅
  Transferir propriedade                      ❌               ❌                   ❌     ✅

> A tabela é uma simplificação. No Discord real, as permissões dependem
> da configuração específica dos cargos e canais.

------------------------------------------------------------------------

# 94. Exemplo de Servidor Completo

``` text
🎮 GAMING COMMUNITY

📌 INFORMAÇÕES
├── # regras
├── # anúncios
├── # novidades
└── # faq

👋 COMUNIDADE
├── # geral
├── # apresentações
├── # memes
├── # screenshots
└── # off-topic

🎮 JOGOS
├── # minecraft
├── # valorant
├── # fortnite
└── # outros-jogos

🆘 SUPORTE
└── Fórum: Ajuda

🔊 VOZ
├── 🔊 Geral
├── 🔊 Squad 1
├── 🔊 Squad 2
└── 🔊 AFK

🔒 STAFF
├── # moderacao
├── # logs
└── 🔊 Reunião Staff
```

------------------------------------------------------------------------

# 95. Exemplo de Cargos

``` text
👑 Dono
🛡️ Administrador
🔨 Moderador
🤖 Bot
💎 VIP
🎮 Gamer
👤 Membro
```

Hierarquia:

``` text
Dono
 ↓
Administrador
 ↓
Moderador
 ↓
Bots/cargos especiais
 ↓
VIP
 ↓
Membro
 ↓
@everyone
```

------------------------------------------------------------------------

# 96. Exemplo de Sistema de Ticket com Aplicativo

Embora tickets não precisem ser uma funcionalidade nativa central,
aplicativos podem implementar:

``` text
Usuário
   ↓
/ticket
   ↓
Bot cria atendimento
   ↓
Canal/thread privado
   ↓
Usuário + Staff
   ↓
Atendimento
   ↓
Encerrar
   ↓
Registrar histórico
```

------------------------------------------------------------------------

# 97. Exemplo de Sistema de Enquete

``` text
Criador
   ↓
Define pergunta
   ↓
Define opções
   ↓
Publica
   ↓
Usuários votam
   ↓
Sistema contabiliza
   ↓
Resultado
```

A plataforma possui recursos nativos e/ou aplicações capazes de atender
cenários de votação, dependendo da versão e contexto.

------------------------------------------------------------------------

# 98. Estados Importantes

## Usuário

``` text
Online
Idle
Do Not Disturb
Offline/Invisible
```

## Membro

``` text
Ativo
Timeout
Removido
Banido
```

## Convite

``` text
Ativo
Expirado
Revogado
Limite atingido
```

## Evento

``` text
Agendado
Em andamento
Encerrado
Cancelado
```

------------------------------------------------------------------------

# 99. Regras de Negócio Essenciais

### RN01

Um usuário precisa estar autenticado para utilizar recursos privados da
conta.

### RN02

Um usuário somente pode visualizar canais aos quais possui acesso.

### RN03

Enviar mensagens exige permissão correspondente.

### RN04

Ações administrativas devem respeitar permissões e hierarquia.

### RN05

Um membro pode possuir vários cargos.

### RN06

Permissões de canal podem alterar o acesso fornecido pelas permissões
gerais.

### RN07

Apenas usuários autorizados podem administrar canais, cargos e membros.

### RN08

Mensagens devem estar associadas a um autor e contexto válido, exceto
casos especiais gerados pelo sistema.

### RN09

Conteúdos removidos não devem continuar aparecendo normalmente aos
clientes.

### RN10

Alterações relevantes devem ser propagadas em tempo real para clientes
conectados.

### RN11

Usuários bloqueados/restritos devem ter as limitações correspondentes
aplicadas.

### RN12

Convites expirados ou revogados não devem permitir novas entradas.

### RN13

Banimentos devem impedir a entrada da conta enquanto permanecerem
ativos.

### RN14

Bots/aplicativos devem operar apenas dentro das autorizações concedidas.

### RN15

Ações administrativas relevantes devem possuir rastreabilidade quando
suportadas pelo sistema.

------------------------------------------------------------------------

# 100. Resumo dos Grandes Módulos

Uma plataforma com funcionalidades equivalentes pode ser dividida em:

``` text
01. Autenticação
02. Usuários
03. Perfis
04. Amigos
05. DMs
06. Servidores
07. Membros
08. Convites
09. Categorias
10. Canais
11. Mensagens
12. Reações
13. Threads
14. Fóruns
15. Arquivos/Mídia
16. Busca
17. Cargos
18. Permissões
19. Voz
20. Vídeo
21. Streaming
22. Eventos
23. Notificações
24. Moderação
25. AutoMod
26. Auditoria
27. Bots/Apps
28. Webhooks
29. Integrações
30. Comunidades
31. Descoberta
32. Personalização
33. Assinaturas/Nitro
34. Benefícios/Boosts
35. Segurança
36. Privacidade
37. Administração
38. Gateway/Tempo Real
39. API
40. Infraestrutura de mídia
```

------------------------------------------------------------------------

# 101. Conclusão

O Discord não é apenas um aplicativo de chat. Ele combina diversos
sistemas:

``` text
Mensageria em tempo real
+
Comunidades
+
Controle de acesso
+
Voz/vídeo
+
Moderação
+
Aplicativos
+
Notificações
+
Personalização
+
Monetização
+
Infraestrutura distribuída
```

O núcleo funcional pode ser resumido por:

``` text
Usuário
   ↓
Servidor
   ↓
Membro
   ↓
Cargo
   ↓
Permissão
   ↓
Canal
   ↓
Mensagem / Voz / Vídeo
```

A camada de **cargos e permissões** é especialmente importante porque
controla praticamente todas as interações dentro de um servidor.

Para construir uma plataforma inspirada no Discord, o desenvolvimento
deve começar pelo núcleo:

``` text
AUTH
 ↓
USERS
 ↓
SERVERS
 ↓
MEMBERS
 ↓
CHANNELS
 ↓
ROLES + PERMISSIONS
 ↓
MESSAGES
 ↓
REAL-TIME
```

Depois disso, podem ser adicionados progressivamente voz, vídeo,
threads, fóruns, moderação avançada, aplicativos, comunidades e
monetização.

------------------------------------------------------------------------

**Documento:** Discord --- Funcionalidades e Funcionamento\
**Formato:** Markdown\
**Atualização:** Setembro de 2026
