export const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export const CURRENT_YEAR = new Date().getFullYear()

export const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i)

export const PIE_COLORS = ['#FF0090', '#34C759', '#FF3B30', '#FFB35C', '#5E5CE6', '#30B0C7']
