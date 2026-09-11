const prisma = require('../config/prisma')
const AppError = require('../utils/AppError')

const createAddress = async (userId, data) => {
    try {
        return await prisma.$transaction(async (tx) => {
            const hasDefault = await tx.address.findFirst({
                where: {
                    userId,
                    isDefault: true
                },
                select: {
                    id: true
                }
            })

            const isDefault = data.isDefault === true || !hasDefault

            if (isDefault) {
                await tx.address.updateMany({
                    where: {
                        userId,
                        isDefault: true
                    },
                    data: {
                        isDefault: false
                    }
                })
            }

            return tx.address.create({
                data: {
                    userId,
                    fullName: data.fullName,
                    phone: data.phone,
                    line1: data.line1,
                    line2: data.line2,
                    city: data.city,
                    state: data.state,
                    pincode: data.pincode,
                    isDefault
                }
            })
        })
    } catch (error) {
        if (error.code === 'P2002') {
            throw new AppError(
                'Another address was made default at the same time. Please try again.',
                409
            )
        }

        throw error
    }
}

const getAddresses = async (userId) => {
    return prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    })
}

const updateAddress = async (userId, id, data) => {
    try {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.address.findFirst({
                where: {
                    id,
                    userId
                }
            })

            if (!existing) {
                throw new AppError('Address not found', 404)
            }

            if (data.isDefault === true) {
                await tx.address.updateMany({
                    where: {
                        userId,
                        isDefault: true,
                        id: { not: id }
                    },
                    data: {
                        isDefault: false
                    }
                })
            }

            if (data.isDefault === false && existing.isDefault) {
                await tx.address.update({
                    where: { id },
                    data: { isDefault: false }
                })

                const next = await tx.address.findFirst({
                    where: {
                        userId,
                        id: { not: id }
                    },
                    orderBy: { createdAt: 'desc' }
                })

                if (next) {
                    await tx.address.update({
                        where: { id: next.id },
                        data: { isDefault: true }
                    })
                }
            }

            return tx.address.update({
                where: { id },
                data
            })
        })
    } catch (error) {
        if (error.code === 'P2002') {
            throw new AppError(
                'Another address was made default at the same time. Please try again.',
                409
            )
        }

        throw error
    }
}

const setDefaultAddress = async (userId, id) => {
    try {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.address.findFirst({
                where: {
                    id,
                    userId
                }
            })

            if (!existing) {
                throw new AppError('Address not found', 404)
            }

            if (existing.isDefault) {
                return existing
            }

            await tx.address.updateMany({
                where: {
                    userId,
                    isDefault: true
                },
                data: {
                    isDefault: false
                }
            })

            return tx.address.update({
                where: {
                    id
                },
                data: {
                    isDefault: true
                }
            })
        })
    } catch (error) {
        if (error.code === 'P2002') {
            throw new AppError(
                'Another address was made default at the same time. Please try again.',
                409
            )
        }

        throw error
    }
}

const deleteAddress = async (userId, id) => {
    try {
        await prisma.$transaction(async (tx) => {
            const existing = await tx.address.findFirst({
                where: {
                    id,
                    userId
                }
            })

            if (!existing) {
                throw new AppError('Address not found', 404)
            }

            await tx.address.delete({
                where: { id }
            })

            if (existing.isDefault) {
                const next = await tx.address.findFirst({
                    where: { userId },
                    orderBy: { createdAt: 'desc' }
                })

                if (next) {
                    await tx.address.update({
                        where: { id: next.id },
                        data: { isDefault: true }
                    })
                }
            }
        })
    } catch (error) {
        if (error.code === 'P2002') {
            throw new AppError(
                'Another address was made default at the same time. Please try again.',
                409
            )
        }

        throw error
    }
}

module.exports = {
    createAddress,
    getAddresses,
    updateAddress,
    setDefaultAddress,
    deleteAddress
}