// Manual Script Tag Cleanup Tool
// Run this in your browser's Developer Console on your Shopify store

console.log("🧹 Starting manual script tag cleanup...");

// Function to get all script tags
async function getAllScriptTags() {
  try {
    const response = await fetch('/admin/api/2023-10/script_tags.json');
    const data = await response.json();
    return data.script_tags || [];
  } catch (error) {
    console.error("❌ Error fetching script tags:", error);
    return [];
  }
}

// Function to delete a script tag
async function deleteScriptTag(scriptTagId) {
  try {
    const response = await fetch(`/admin/api/2023-10/script_tags/${scriptTagId}.json`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      console.log(`✅ Successfully deleted script tag: ${scriptTagId}`);
      return true;
    } else {
      console.log(`❌ Failed to delete script tag: ${scriptTagId}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting script tag ${scriptTagId}:`, error);
    return false;
  }
}

// Main cleanup function
async function cleanupScriptTags() {
  console.log("🔍 Fetching all script tags...");
  
  const scriptTags = await getAllScriptTags();
  console.log(`📋 Found ${scriptTags.length} total script tags`);
  
  // Filter for ab-price-test script tags
  const abTestTags = scriptTags.filter(tag => 
    tag.src && tag.src.includes('ab-price-test')
  );
  
  console.log(`🎯 Found ${abTestTags.length} A/B test script tags to delete:`);
  abTestTags.forEach(tag => {
    console.log(`  - ID: ${tag.id}, SRC: ${tag.src}`);
  });
  
  if (abTestTags.length === 0) {
    console.log("✅ No A/B test script tags found to delete!");
    return;
  }
  
  // Delete each script tag
  let deletedCount = 0;
  for (const tag of abTestTags) {
    const success = await deleteScriptTag(tag.id);
    if (success) {
      deletedCount++;
    }
  }
  
  console.log(`🎉 Cleanup complete! Deleted ${deletedCount} out of ${abTestTags.length} script tags`);
  
  // Verify cleanup
  console.log("🔍 Verifying cleanup...");
  const remainingTags = await getAllScriptTags();
  const remainingAbTestTags = remainingTags.filter(tag => 
    tag.src && tag.src.includes('ab-price-test')
  );
  
  if (remainingAbTestTags.length === 0) {
    console.log("✅ All A/B test script tags successfully removed!");
  } else {
    console.log(`⚠️ ${remainingAbTestTags.length} A/B test script tags still remain`);
  }
}

// Run the cleanup
cleanupScriptTags();


