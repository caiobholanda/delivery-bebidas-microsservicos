# Deploy na nuvem

Cada serviço usa:

- **Banco:** TiDB Cloud Starter (compatível com MySQL, grátis)
- **Serviço:** Render (Web Service, plano Free)
- **Front:** Render (Static Site)

Cada integrante faz o deploy na própria conta do TiDB e do Render.

---

## 1. Banco de dados (TiDB Cloud)

Crie **um banco para cada serviço**.

1. Acesse https://tidbcloud.com e entre com o GitHub.
2. Clique em **Create Resource** e preencha:

| Campo | Valor |
|---|---|
| Plan | Starter |
| Compatibility Mode | MySQL Compatible |
| Instance Name | nome do serviço (ex.: `pedidos`) |
| Cloud Provider | AWS |
| Region | N. Virginia (us-east-1) |
| Monthly Spending Limit | $0 |

3. Clique em **Create** e espere o status ficar **Active**.
4. Clique em **Connect**, escolha **Connect With: General** e clique em **Generate Password**. A senha só aparece uma vez.
5. Anote **HOST**, **PORT** (4000), **USERNAME** e **PASSWORD**.

O TiDB exige conexão com TLS (SSL).

### String de conexão

| Linguagem | Formato |
|---|---|
| Node.js (mysql2) | `mysql://USUARIO:SENHA@HOST:4000/NOME_DO_BANCO` + `DB_SSL=true` |
| Java (JDBC) | `jdbc:mysql://HOST:4000/NOME_DO_BANCO?sslMode=VERIFY_IDENTITY` |
| Python (SQLAlchemy + PyMySQL) | `mysql+pymysql://USUARIO:SENHA@HOST:4000/NOME_DO_BANCO?ssl_ca=/etc/ssl/certs/ca-certificates.crt&ssl_verify_cert=true&ssl_verify_identity=true` |

Se a senha tiver caracteres especiais, substitua: `@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`, `%` → `%25`, `?` → `%3F`.

O banco (`CREATE DATABASE`) precisa existir. Os serviços de Pedidos, Pagamento, Estoque e Entregas criam sozinhos. Nos outros, rode no **SQL Editor** do TiDB:

```sql
CREATE DATABASE nome_do_banco;
```

---

## 2. Serviço (Render Web Service)

1. Acesse https://render.com e entre com o GitHub.
2. Clique em **New → Web Service** e escolha o repositório `delivery-bebidas-microsservicos`.
3. **Apague o nome que vem preenchido** e coloque o nome do serviço. Ele vira a URL (`https://NOME.onrender.com`).
4. Preencha conforme a linguagem:

| Campo | Node.js | Python | Java |
|---|---|---|---|
| Language | Node | Python 3 | Docker |
| Root Directory | pasta do serviço | pasta do serviço | pasta do serviço |
| Build Command | `npm install` | `pip install -r requirements.txt` | (não usa) |
| Start Command | `npm start` | ver abaixo | (não usa) |
| Instance Type | Free | Free | Free |
| Region | Virginia (US East) | Virginia (US East) | Virginia (US East) |

5. Em **Environment Variables → Add from .env**, cole as variáveis do serviço.
6. Clique em **Deploy Web Service** e espere aparecer **Live**.
7. Teste `https://NOME.onrender.com/health` (ou outra rota simples).

### Porta

O Render define a porta na variável `PORT`. O serviço **precisa** ouvir nessa porta.

### Python

Start Command, conforme o framework:

| Framework | Start Command |
|---|---|
| FastAPI | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Flask | `gunicorn app:app --bind 0.0.0.0:$PORT` |

Troque `main:app` / `app:app` pelo `arquivo:variável` do seu projeto. Coloque `uvicorn` ou `gunicorn` no `requirements.txt`.

No Estoque e no Entregas o Start Command é `uvicorn main:app --host 0.0.0.0 --port $PORT`. No Entregas, coloque também `PEDIDOS_URL` nas variáveis. Depois de publicar, peça para quem cuida do Pedidos colocar `ESTOQUE_URL` e `ENTREGAS_URL` no Render dele.

### Java

O Render não tem runtime Java. Use Docker. Crie um `Dockerfile` na pasta do serviço (exemplo para Maven):

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn -q clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
```

Para Spring Boot, as variáveis de banco no Render ficam:

```
SPRING_DATASOURCE_URL=jdbc:mysql://HOST:4000/NOME_DO_BANCO?sslMode=VERIFY_IDENTITY
SPRING_DATASOURCE_USERNAME=USUARIO
SPRING_DATASOURCE_PASSWORD=SENHA
```

### CORS

O front chama os serviços direto do navegador. Todo serviço precisa liberar CORS:

| Linguagem | Como |
|---|---|
| Node (Express) | `app.use(cors())` |
| Python (FastAPI) | `CORSMiddleware` com `allow_origins=["*"]` |
| Python (Flask) | `flask-cors`: `CORS(app)` |
| Java (Spring) | `@CrossOrigin(origins = "*")` nos controllers |

---

## 3. Front (Render Static Site)

1. No `index.html`, troque as URLs `localhost` pelas URLs do Render.
2. Faça commit e push.
3. No Render, clique em **New → Static Site**, escolha o repositório e preencha:

| Campo | Valor |
|---|---|
| Name | `delivery-bebidas-front` |
| Root Directory | pasta do front |
| Build Command | (vazio) |
| Publish Directory | `.` |

---

## 4. Observações

- O plano Free do Render **dorme após 15 minutos** sem uso. A primeira chamada pode levar até 1 minuto. Antes de apresentar, abra o `/health` de todos os serviços.
- Alterar uma variável em **Environment** refaz o deploy automaticamente.
- Todo `git push` na pasta do serviço refaz o deploy dele.
- Nunca faça commit do `.env`. Senhas ficam só no Render.
- Se o log mostrar erro de conexão com o banco, confira usuário, senha, host, porta 4000 e SSL.

## 5. Serviços publicados

| Serviço | Responsável | URL |
|---|---|---|
| Autenticação | João Gabriel | https://autenticacao-service-joao.onrender.com |
| Catálogo | João Gabriel | https://catalogo-service-joao.onrender.com |
| Estoque | Vitor Costa | https://estoque-service-vitor.onrender.com |
| Entregas | Vitor Costa | https://entregas-service-vitor.onrender.com |
| Pedidos | Caio Barsi | https://pedidos-service-caio.onrender.com |
| Pagamento | Caio Barsi | https://pagamento-service-caio.onrender.com |
| Front | Caio Barsi | https://delivery-bebidas-front.onrender.com |
| Front (login e catálogo) | João Gabriel | https://delivery-bebidas-front-joao.onrender.com |
| Front (estoque e entregas) | Vitor Costa | https://delivery-bebidas-front-vitor.onrender.com |
