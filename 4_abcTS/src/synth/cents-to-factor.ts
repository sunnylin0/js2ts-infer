export default function centsToFactor(cents): number {
    return Math.pow(2, cents / 1200);
}
