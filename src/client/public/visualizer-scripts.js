 // State variables
 let recipients = [];
 let filteredRecipients = [];
 let currentSort = { field: 'lastChecked', direction: 'desc' };

 // Simple date formatter that doesn't require external libraries
 function formatDate(dateString) {
     if (!dateString) return 'N/A';
     
     try {
         const date = new Date(dateString);
         
         // Check if date is valid
         if (isNaN(date.getTime())) return 'Invalid Date';
         
         // Format: YYYY-MM-DD HH:MM:SS
         const pad = (num) => String(num).padStart(2, '0');
         
         const year = date.getFullYear();
         const month = pad(date.getMonth() + 1);
         const day = pad(date.getDate());
         const hours = pad(date.getHours());
         const minutes = pad(date.getMinutes());
         const seconds = pad(date.getSeconds());
         
         return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
     } catch (e) {
         console.error('Date formatting error:', e);
         return dateString; // Return original string if parsing fails
     }
 }

 // Format address for display
 function formatAddress(address) {
     if (!address) return 'N/A';
     return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
 }

 // Copy text to clipboard
 function copyToClipboard(text) {
     navigator.clipboard.writeText(text).then(() => {
         alert('Copied to clipboard: ' + text);
     }).catch(err => {
         console.error('Failed to copy: ', err);
     });
 }

 // Load data
 async function loadData() {
     try {
         console.log("Starting data fetch...");
         
         // Properly fetch and parse the data
         const response = await fetch("/recipients");
         
         if (!response.ok) {
             throw new Error(`HTTP error! Status: ${response.status}`);
         }
         
         // Get the JSON data
         recipients = await response.json();
         console.log("Data loaded:", recipients.length, "recipients");
         
         // Update UI
         updateStats();
         applyFiltersAndSort();
     } catch (error) {
         console.error("Error loading data:", error);
         document.getElementById('table-body').innerHTML = `
             <tr>
                 <td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">
                     Error loading data: ${error.message}
                 </td>
             </tr>
         `;
     }
 }

 // Update stats display
 function updateStats() {
     const total = recipients.length;
     const withLocker = recipients.filter(r => r.lockerAddress).length;
     const claimed = recipients.filter(r => r.claimed).length;
     
     document.getElementById('total-count').textContent = total;
     document.getElementById('locker-count').textContent = withLocker;
     document.getElementById('claimed-count').textContent = claimed;
     
     const lockerPercent = total > 0 ? Math.round((withLocker / total) * 100) : 0;
     const claimedPercent = total > 0 ? Math.round((claimed / total) * 100) : 0;
     
     document.getElementById('locker-percent').textContent = `${lockerPercent}%`;
     document.getElementById('claimed-percent').textContent = `${claimedPercent}%`;
     
     // Find most recent update
     if (recipients.length > 0) {
         const lastCheckedDates = recipients
             .map(r => r.lastChecked)
             .filter(Boolean)
             .sort((a, b) => new Date(b) - new Date(a));
         
         if (lastCheckedDates.length > 0) {
             document.getElementById('last-updated').textContent = formatDate(lastCheckedDates[0]);
         }
     }
 }

 // Apply filters and sort
 function applyFiltersAndSort() {
     const addressFilter = document.getElementById('filter-address').value.toLowerCase();
     const claimedFilter = document.getElementById('filter-claimed').value;
     const lockerFilter = document.getElementById('filter-locker').value;
     
     // Apply filters
     filteredRecipients = recipients.filter(recipient => {
         // Address filter
         const addressMatch = recipient.address.toLowerCase().includes(addressFilter);
         
         // Claimed filter
         let claimedMatch = true;
         if (claimedFilter === 'true') claimedMatch = recipient.claimed === true;
         if (claimedFilter === 'false') claimedMatch = recipient.claimed !== true;
         
         // Locker filter
         let lockerMatch = true;
         if (lockerFilter === 'true') lockerMatch = !!recipient.lockerAddress;
         if (lockerFilter === 'false') lockerMatch = !recipient.lockerAddress;
         
         return addressMatch && claimedMatch && lockerMatch;
     });
     
     // Apply sort
     filteredRecipients.sort((a, b) => {
         const aValue = a[currentSort.field] || '';
         const bValue = b[currentSort.field] || '';
         
         // Special handling for boolean values
         if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
             return currentSort.direction === 'asc' 
                 ? (aValue === bValue ? 0 : aValue ? -1 : 1)
                 : (aValue === bValue ? 0 : aValue ? 1 : -1);
         }
         
         // Sort for strings and dates
         if (currentSort.direction === 'asc') {
             return aValue > bValue ? 1 : -1;
         } else {
             return aValue < bValue ? 1 : -1;
         }
     });
     
     // Update table
     renderTable();
 }

 // Render table with current data
 function renderTable() {
     const tableBody = document.getElementById('table-body');
     
     if (filteredRecipients.length === 0) {
         tableBody.innerHTML = `
             <tr>
                 <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                     No recipients found matching your filters
                 </td>
             </tr>
         `;
         document.getElementById('showing-count').textContent = '0';
         document.getElementById('total-rows').textContent = recipients.length;
         return;
     }
     
     let tableHtml = '';
     
     filteredRecipients.forEach((recipient, index) => {
         tableHtml += `
             <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     <div class="flex items-center">
                         <span class="cursor-pointer hover:text-blue-600" 
                             onclick="copyToClipboard('${recipient.address}')" 
                             title="Click to copy full address">
                             ${formatAddress(recipient.address)}
                         </span>
                     </div>
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     ${formatDate(recipient.topUpDate)}
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap">
                     <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                         recipient.claimed 
                             ? 'bg-green-100 text-green-800' 
                             : 'bg-yellow-100 text-yellow-800'
                     }">
                         ${recipient.claimed ? 'Yes' : 'No'}
                     </span>
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     ${recipient.lockerAddress 
                         ? `<span class="cursor-pointer hover:text-blue-600" 
                              onclick="copyToClipboard('${recipient.lockerAddress}')" 
                              title="Click to copy full address">
                              ${formatAddress(recipient.lockerAddress)}
                            </span>` 
                         : 'N/A'
                     }
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     ${formatDate(recipient.lockerCheckedDate)}
                 </td>
                 <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     ${formatDate(recipient.lastChecked)}
                 </td>
             </tr>
         `;
     });
     
     tableBody.innerHTML = tableHtml;
     document.getElementById('showing-count').textContent = filteredRecipients.length;
     document.getElementById('total-rows').textContent = recipients.length;
 }

 // Set up sorting
 function setupSorting() {
     const tableHeaders = document.querySelectorAll('th[data-sort]');
     
     tableHeaders.forEach(header => {
         header.addEventListener('click', () => {
             const field = header.getAttribute('data-sort');
             
             // Update sort direction
             if (currentSort.field === field) {
                 currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
             } else {
                 currentSort.field = field;
                 currentSort.direction = 'asc';
             }
             
             // Update header classes
             tableHeaders.forEach(h => {
                 h.classList.remove('asc', 'desc');
             });
             
             header.classList.add(currentSort.direction);
             
             // Apply sort
             applyFiltersAndSort();
         });
     });
 }

 // Set up filter event listeners
 function setupFilters() {
     const addressFilter = document.getElementById('filter-address');
     const claimedFilter = document.getElementById('filter-claimed');
     const lockerFilter = document.getElementById('filter-locker');
     
     // Add event listeners
     addressFilter.addEventListener('input', applyFiltersAndSort);
     claimedFilter.addEventListener('change', applyFiltersAndSort);
     lockerFilter.addEventListener('change', applyFiltersAndSort);
 }

 // Initialize
 document.addEventListener('DOMContentLoaded', () => {
     console.log("Page loaded, initializing...");
     setupSorting();
     setupFilters();
     loadData();
 });