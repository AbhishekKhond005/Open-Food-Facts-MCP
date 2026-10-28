FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src/main ./src/main
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/simulator-1.0.0.jar app.jar
EXPOSE 3001
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
