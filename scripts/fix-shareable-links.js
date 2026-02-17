const mongoose = require('mongoose');
const path = require('path');

// Load the PeerRoom model - try both .js and .ts extensions
let PeerRoom;
try {
  PeerRoom = require(path.join(__dirname, '../src/models/PeerRoom.js'));
} catch (error) {
  // If .js doesn't exist, we'll need to handle this differently
  console.log('PeerRoom.js not found, this script needs to be run after TypeScript compilation');
  process.exit(1);
}

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Fix existing shareable links to use frontend URL
async function fixShareableLinks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log(`Updating shareable links to use: ${frontendUrl}`);

    // Find all rooms that have shareable links
    const rooms = await PeerRoom.find({ shareableLink: { $exists: true } });
    console.log(`Found ${rooms.length} rooms with shareable links`);

    let updated = 0;
    for (const room of rooms) {
      const currentShareCode = room.shareCode;
      const newShareableLink = `${frontendUrl}/room/${currentShareCode}`;
      
      // Update the shareable link
      await PeerRoom.updateOne(
        { _id: room._id },
        { shareableLink: newShareableLink }
      );
      
      console.log(`Updated room "${room.name}" (${room._id}): ${room.shareableLink} -> ${newShareableLink}`);
      updated++;
    }

    console.log(`Successfully updated ${updated} rooms`);
    process.exit(0);
  } catch (error) {
    console.error('Error fixing shareable links:', error);
    process.exit(1);
  }
}

fixShareableLinks();
