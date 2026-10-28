// Remove only lines PTK added; preserve every other byte, including line endings.
function removeOwnedHostEntries(content, hosts) {
  const targets = new Set(hosts);
  return content.split(/(?<=\n)/).filter(line => {
    if (!line.includes("# PTK-Proxy-Tools")) return true;
    const fields = line.split("#")[0].trim().split(/\s+/).slice(1);
    return !fields.some(host => targets.has(host));
  }).join("");
}
module.exports = {removeOwnedHostEntries};
