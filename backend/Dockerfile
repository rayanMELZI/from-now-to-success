# ---- Stage 1: build the jar (JDK + Maven wrapper) ----
FROM eclipse-temurin:24-jdk-alpine AS build
WORKDIR /app

# Copy only what's needed to resolve dependencies first, so this expensive
# layer is cached until pom.xml actually changes.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -B -q

# Now the source; editing code only rebuilds from this layer down.
COPY src src
RUN ./mvnw package -DskipTests -B -q

# ---- Stage 2: minimal runtime (JRE only, no build tools) ----
FROM eclipse-temurin:24-jre-alpine
WORKDIR /app

# Never run as root inside the container.
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
