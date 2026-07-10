/**
 * Core game mechanics for SlowAndSteady 2.
 *
 * Points formula:
 *   donationAmount = floor((wallet + secondsSinceLastDonation * cbrt(totalDonated)) / 2)
 *
 * A player can donate when:
 *   cbrt(totalDonated + donationAmount) - cbrt(totalDonated) > 1
 *
 * On donation:
 *   - Donor's wallet resets to 0
 *   - Donor's last_donated updates to now
 *   - Donor's total_donated increases by donationAmount
 *   - Donor's leaderboard score increases by donationAmount * 2
 *   - Recipient's wallet increases by donationAmount
 *   - Transaction logged in both _from and _to lists
 */

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function calculateDonation(player) {
  const wallet = parseInt(player.wallet, 10) || 0;
  const totalDonated = parseInt(player.total_donated, 10) || 1;
  const lastDonated = parseInt(player.last_donated, 10) || nowSeconds();
  const elapsed = nowSeconds() - lastDonated;
  const multiplier = Math.cbrt(totalDonated);

  return Math.floor((wallet + elapsed * multiplier) / 2);
}

export function canDonate(player) {
  const amount = calculateDonation(player);
  const totalDonated = parseInt(player.total_donated, 10) || 1;
  return Math.cbrt(totalDonated + amount) - Math.cbrt(totalDonated) > 1;
}

export function donationProgress(player) {
  const amount = calculateDonation(player);
  const totalDonated = parseInt(player.total_donated, 10) || 1;
  const progress = Math.cbrt(totalDonated + amount) - Math.cbrt(totalDonated);
  return Math.min(progress, 1);
}
