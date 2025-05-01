  /**
   * Format SUP income to be more readable (in SUP/month)
   */
  export function formatSUPIncome(weiPerSecond: string, units: string = 'SUP/month'): string {
    if (weiPerSecond === '0') return `0 ${units}`;
    
    try {
      const bigWeiPerSecond = BigInt(weiPerSecond);
      
      // Convert wei/second to SUP/month
      // SUP/month = (wei/s * seconds_per_month) / 1e18
      const secondsPerMonth = 60 * 60 * 24 * 30; // ~30 days
      const weiPerMonth = bigWeiPerSecond * BigInt(secondsPerMonth);
      const supPerMonth = Number(weiPerMonth) / 1e18;

      // Format based on size
      if (supPerMonth >= 100000) {
        return `${(supPerMonth / 1000).toFixed(0)}k ${units}`;
      } else if (supPerMonth >= 1000) {
        return `${supPerMonth.toFixed(0)} ${units}`;
      } else if (supPerMonth >= 1) {
        return `${supPerMonth.toFixed(2)} ${units}`;
      } else if (supPerMonth >= 0.001) {
        return `${supPerMonth.toFixed(3)} ${units}`;
      } else {
        return `${supPerMonth.toExponential(2)} ${units}`;
    }
  } catch (error) {
    return weiPerSecond;
  }
}