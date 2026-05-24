/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { ProductCard } from '@/components/ProductCard'

const mockProduct = {
  id: 'prod_123',
  name: 'Test Product',
  description: 'This is a test product',
  price: 99.99,
  warehouses: [
    {
      warehouseId: 'wh_1',
      total: 10,
      reserved: 2,
      available: 8,
    },
    {
      warehouseId: 'wh_2',
      total: 5,
      reserved: 5,
      available: 0,
    },
  ],
}

test('renders product information correctly', () => {
  render(
    <ProductCard
      product={mockProduct}
      selectedWarehouseId="wh_1"
      onReserve={vi.fn()}
    />
  )

  // Name and price
  expect(screen.getByText('Test Product')).toBeInTheDocument()
  expect(screen.getByText('$99.99')).toBeInTheDocument()
  expect(screen.getByText('This is a test product')).toBeInTheDocument()

  // Stock badge
  expect(screen.getByText('8 available')).toBeInTheDocument()

  // Stock details
  expect(screen.getByText('Total')).toBeInTheDocument()
  expect(screen.getByText('10')).toBeInTheDocument()
  expect(screen.getByText('Reserved')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('Available')).toBeInTheDocument()
  expect(screen.getByText('8')).toBeInTheDocument()

  // Reserve button
  const button = screen.getByRole('button', { name: /Reserve Test Product/i })
  expect(button).toBeInTheDocument()
  expect(button).not.toBeDisabled()
})

test('disables reserve button and shows out of stock when available is 0', () => {
  render(
    <ProductCard
      product={mockProduct}
      selectedWarehouseId="wh_2"
      onReserve={vi.fn()}
    />
  )

  // Stock badge
  expect(screen.getByText('Out of Stock', { selector: 'span' })).toBeInTheDocument()

  // Reserve button
  const button = screen.getByRole('button', { name: /Test Product is out of stock/i })
  expect(button).toBeInTheDocument()
  expect(button).toBeDisabled()
})

test('disables reserve button when no warehouse is selected', () => {
  render(
    <ProductCard
      product={mockProduct}
      selectedWarehouseId=""
      onReserve={vi.fn()}
    />
  )

  // Reserve button
  const button = screen.getByRole('button', { name: /Select a warehouse to reserve/i })
  expect(button).toBeInTheDocument()
  expect(button).toBeDisabled()
})

test('calls onReserve with correct arguments when reserve button is clicked', () => {
  const onReserveMock = vi.fn()
  render(
    <ProductCard
      product={mockProduct}
      selectedWarehouseId="wh_1"
      onReserve={onReserveMock}
    />
  )

  const button = screen.getByRole('button', { name: /Reserve Test Product/i })
  fireEvent.click(button)

  expect(onReserveMock).toHaveBeenCalledTimes(1)
  expect(onReserveMock).toHaveBeenCalledWith('prod_123', 'wh_1')
})

test('shows reserving state when isReserving is true', () => {
  render(
    <ProductCard
      product={mockProduct}
      selectedWarehouseId="wh_1"
      onReserve={vi.fn()}
      isReserving={true}
    />
  )

  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('Reserving…')
  expect(button).toBeDisabled()
})
