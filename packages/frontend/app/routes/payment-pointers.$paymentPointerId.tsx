import { json, type ActionArgs, type LoaderArgs } from '@remix-run/node'
import {
  Form,
  Outlet,
  useActionData,
  useLoaderData,
  useNavigation
} from '@remix-run/react'
import { z } from 'zod'
import { PageHeader } from '~/components'
import { Button, ErrorPanel, Input, Dropdown } from '~/components/ui'
import {
  getPaymentPointer,
  updatePaymentPointer
} from '~/lib/api/payment-pointer.server'
import { messageStorage, setMessageAndRedirect } from '~/lib/message.server'
import { updatePaymentPointerSchema } from '~/lib/validate.server'
import type { ZodFieldErrors } from '~/shared/types'
import { capitalize } from '~/shared/utils'

export async function loader({ params }: LoaderArgs) {
  const paymentPointerId = params.paymentPointerId

  const result = z.string().uuid().safeParse(paymentPointerId)
  if (!result.success) {
    throw json(null, { status: 400, statusText: 'Invalid payment pointer ID.' })
  }

  const paymentPointer = await getPaymentPointer({ id: result.data })

  if (!paymentPointer) {
    throw json(null, { status: 404, statusText: 'Payment pointer not found.' })
  }

  return json({
    paymentPointer: {
      ...paymentPointer,
      createdAt: new Date(paymentPointer.createdAt).toLocaleString()
    }
  })
}

export default function ViewAssetPage() {
  const { paymentPointer } = useLoaderData<typeof loader>()
  const response = useActionData<typeof action>()
  const navigation = useNavigation()

  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className='pt-4 flex flex-col space-y-4'>
      <div className='flex flex-col rounded-md bg-offwhite px-6'>
        <PageHeader className='!justify-end'>
          <Button
            aria-label='go back to payment pointers page'
            to='/payment-pointers'
          >
            Go to payment pointers page
          </Button>
        </PageHeader>
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>General Information</h3>
            <p className='text-sm'>Created at {paymentPointer.createdAt}</p>
            <ErrorPanel errors={response?.errors.message} />
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <Form method='post' replace preventScrollReset>
              <fieldset disabled={isSubmitting}>
                <div className='w-full p-4 space-y-3'>
                  <Input type='hidden' name='id' value={paymentPointer.id} />
                  <Input
                    label='ID'
                    value={paymentPointer.id}
                    disabled
                    readOnly
                  />
                  <Input
                    label='URL'
                    value={paymentPointer.url}
                    disabled
                    readOnly
                  />
                  <Input
                    name='publicName'
                    label='Public name'
                    defaultValue={paymentPointer.publicName ?? undefined}
                    error={response?.errors.fieldErrors.publicName}
                  />
                  <Dropdown
                    options={[
                      { label: 'Active', value: 'ACTIVE' },
                      { label: 'Inactive', value: 'INACTIVE' }
                    ]}
                    name='status'
                    placeholder='Select status...'
                    defaultValue={{
                      label: capitalize(paymentPointer.status),
                      value: paymentPointer.status
                    }}
                    error={response?.errors.fieldErrors.status}
                    label='Status'
                    required
                  />
                </div>
                <div className='flex justify-end p-4'>
                  <Button
                    aria-label='save payment pointer information'
                    type='submit'
                  >
                    {isSubmitting ? 'Saving ...' : 'Save'}
                  </Button>
                </div>
              </fieldset>
            </Form>
          </div>
        </div>
        <div className='grid grid-cols-1 py-3 gap-6 md:grid-cols-3 border-b border-pearl'>
          <div className='col-span-1 pt-3'>
            <h3 className='text-lg font-medium'>Asset Information</h3>
          </div>
          <div className='md:col-span-2 bg-white rounded-md shadow-md'>
            <div className='w-full p-4 gap-4 grid grid-cols-1 lg:grid-cols-3'>
              <div>
                <p className='font-medium'>Code</p>
                <p className='mt-1'>{paymentPointer.asset.code}</p>
              </div>
              <div>
                <p className='font-medium'>Scale</p>
                <p className='mt-1'>{paymentPointer.asset.scale}</p>
              </div>
              <div>
                <p className='font-medium'>Withdrawal threshold</p>
                <p className='mt-1'>
                  {paymentPointer.asset.withdrawalThreshold ??
                    'No withdrawal threshhold'}
                </p>
              </div>
            </div>
            <div className='flex justify-end p-4'>
              <Button
                aria-label='go to asset page'
                type='button'
                to={`/assets/${paymentPointer.asset.id}`}
              >
                View asset
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Outlet />
    </div>
  )
}

export async function action({ request }: ActionArgs) {
  const actionResponse: {
    errors: {
      fieldErrors: ZodFieldErrors<typeof updatePaymentPointerSchema>
      message: string[]
    }
  } = {
    errors: {
      fieldErrors: {},
      message: []
    }
  }

  const formData = Object.fromEntries(await request.formData())

  const result = updatePaymentPointerSchema.safeParse(formData)

  if (!result.success) {
    actionResponse.errors.fieldErrors = result.error.flatten().fieldErrors
    return json({ ...actionResponse }, { status: 400 })
  }

  const response = await updatePaymentPointer({
    ...result.data
  })

  if (!response?.success) {
    actionResponse.errors.message = [
      response?.message ??
        'Could not update the payment pointer. Please try again!'
    ]
    return json({ ...actionResponse }, { status: 400 })
  }

  const session = await messageStorage.getSession(request.headers.get('cookie'))

  return setMessageAndRedirect({
    session,
    message: {
      content: 'Payment pointer was updated',
      type: 'success'
    },
    location: '.'
  })
}
