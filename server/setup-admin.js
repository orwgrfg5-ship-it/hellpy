#!/usr/bin/env node
/**
 * Setup script to make a user a site owner
 * Usage: node setup-admin.js <username>
 */

require('dotenv').config();
const prisma = require('./src/prisma');

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: node setup-admin.js <username>');
    console.error('Example: node setup-admin.js memegodmidas');
    process.exit(1);
  }

  try {
    console.log(`\n🔍 Looking for user: ${username}`);
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, email: true, isSiteOwner: true, isSiteAdmin: true },
    });

    if (!user) {
      console.error(`❌ User "${username}" not found!`);
      process.exit(1);
    }

    if (user.isSiteOwner) {
      console.log(`✅ User "${username}" is already a site owner!`);
      process.exit(0);
    }

    console.log(`\n👤 Found user:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current: ${user.isSiteOwner ? 'Site Owner' : 'Regular User'}\n`);

    console.log(`⚙️  Promoting "${username}" to site owner...\n`);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isSiteOwner: true, isSiteAdmin: true },
      select: { username: true, isSiteOwner: true, isSiteAdmin: true },
    });

    console.log(`✅ Success! User promoted:\n`);
    console.log(`   Username: ${updated.username}`);
    console.log(`   Site Owner: ${updated.isSiteOwner}`);
    console.log(`   Site Admin: ${updated.isSiteAdmin}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
