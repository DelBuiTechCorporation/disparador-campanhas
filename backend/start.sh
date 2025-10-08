#!/bin/sh

echo "🚀 Starting Astra Campaign Backend..."

# Aguardar um pouco para o banco subir
echo "⏳ Waiting for database startup..."
sleep 20

# Função para verificar se as tabelas existem
check_tables() {
    echo "🔍 Checking if tables exist..."
    npx prisma db execute --stdin <<EOF > /dev/null 2>&1
SELECT 1 FROM users LIMIT 1;
EOF
}

# Tentar múltiplas estratégias para criar o schema
echo "🔄 Setting up database schema..."

# Estratégia 1: db push
echo "📋 Strategy 1: Creating schema with db push..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Schema created successfully with db push"
else
    echo "⚠️ db push failed, trying reset..."

    # Estratégia 2: reset completo
    echo "📋 Strategy 2: Resetting database..."
    if npx prisma db push --force-reset --accept-data-loss; then
        echo "✅ Schema reset and created successfully"
    else
        echo "⚠️ Reset failed, trying migrations..."

        # Estratégia 3: migrations
        echo "📋 Strategy 3: Running migrations..."
        npx prisma migrate deploy || echo "⚠️ Migrations also failed"
    fi
fi

# Verificar se as tabelas foram criadas
if check_tables; then
    echo "✅ Database tables verified successfully"
else
    echo "⚠️ Tables not found, but continuing anyway..."
fi

# Executar seed
if [ "$SKIP_DEFAULT_SEED" = "true" ]; then
    echo "🌱 Database seed skipped (SKIP_DEFAULT_SEED=true)"
else
    echo "🌱 Running database seed..."
    npx prisma db seed || echo "⚠️ Seed failed, continuing..."
fi

# Gerar cliente prisma
echo "🔧 Generating Prisma client..."
npx prisma generate || echo "⚠️ Prisma generate failed, continuing..."

# Skip admin user creation - now handled by setup process

# Iniciar servidor
echo "🎯 Starting server..."
exec node dist/server.js