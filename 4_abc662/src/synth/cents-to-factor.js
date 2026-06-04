export default function centsToFactor(cents) {
    return Math.pow(2, cents / 1200);
}
