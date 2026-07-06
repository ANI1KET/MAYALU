const fs = require('fs');
const crypto = require('crypto');
const VARS = [
  {key:'baseUrl',value:'http://localhost:8000/api/v1',description:'API base URL'},
  {key:'adminKey',value:'',description:'Must match ADMIN_SECRET_KEY in your .env'},
  {key:'testPhone',value:'+9779800000001',description:'Nepal number for OTP login flow'},
  {key:'userId',value:'',description:'Auto-set by Get Current User'},
  {key:'shopId',value:'',description:'Auto-set by Create Shop'},
  {key:'categoryId',value:'',description:'Auto-set by Get Category Tree'},
  {key:'colorAttributeId',value:'',description:'Auto-set by Get Attribute by Code (color)'},
  {key:'colorOptionId',value:'',description:'Auto-set by Get Attribute by Code (color)'},
  {key:'productId',value:'',description:'Auto-set by [CMS] Create Product'},
  {key:'variantId',value:'',description:'Auto-set by [CMS] Add Variant'},
  {key:'warehouseId',value:'',description:'Auto-set by Create Warehouse'},
  {key:'inventoryId',value:'',description:'Auto-set by Get Inventory List'},
  {key:'addressId',value:'',description:'Auto-set by Add Delivery Address'},
  {key:'cartItemId',value:'',description:'Auto-set by Add Item to Cart'},
  {key:'orderId',value:'',description:'Auto-set by Place Order'},
  {key:'couponId',value:'',description:'Auto-set by [Admin] Create Coupon'},
  {key:'bannerId',value:'',description:'Auto-set by [Admin] Create Banner'},
  {key:'reviewId',value:'',description:'Auto-set by [Admin] Get Pending Reviews'},
  {key:'notificationId',value:'',description:'Auto-set by Get Notifications'},
];
const NIL='00000000-0000-0000-0000-000000000000';
const e=(s,c,m)=>({statusCode:s,code:c,message:m});
const exU=(b)=>({name:'❌ 401 Unauthorized — missing/expired session',status:401,skipAuth:true,reqBody:b,body:e(401,'MISSING_ACCESS_TOKEN','Access token missing or invalid. Please log in.')});
const exAU=(b)=>({name:'❌ 401 Unauthorized — missing/invalid x-admin-key',status:401,skipAuth:true,noAdminKey:true,reqBody:b,body:e(401,'INVALID_ADMIN_KEY','Missing or invalid x-admin-key header.')});
const exV=(b,m,n)=>({name:n||'❌ 400 Validation error',status:400,reqBody:b,body:e(400,'VALIDATION_ERROR',m)});
const exNF=(c,m,b)=>({name:'❌ 404 Not Found',status:404,reqBody:b,body:e(404,c,m)});

const FOLDERS=[
{name:'Auth',items:[
  {name:'Send OTP',method:'POST',path:'/auth/otp/send',skipAuth:true,body:{phone:'{{testPhone}}',purpose:'login'},examples:[
    {name:'✅ 200 OTP sent',status:200,body:{message:'OTP sent to +9779800000001. Valid for 5 minutes.',cooldownSeconds:60}},
    exV({phone:'12345',purpose:'login'},'phone must be a valid Nepal mobile number','❌ 400 Invalid phone format'),
    exV({purpose:'login'},'phone should not be empty','❌ 400 Missing phone'),
    exV({phone:'{{testPhone}}'},'purpose must be one of: login, register, reset_phone','❌ 400 Missing purpose'),
    exV({phone:'{{testPhone}}',purpose:'hack'},'purpose must be one of: login, register, reset_phone','❌ 400 Invalid purpose'),
    {name:'❌ 400 OTP cooldown active',status:400,reqBody:{phone:'{{testPhone}}',purpose:'login'},body:e(400,'OTP_COOLDOWN','Please wait 47 seconds before requesting another OTP.')},
  ]},
  {name:'Verify OTP & Login',method:'POST',path:'/auth/otp/verify',skipAuth:true,
    description:"Sets access_token & refresh_token as HttpOnly cookies — Postman's cookie jar captures and replays them automatically on every later request.",
    body:{phone:'{{testPhone}}',otp:'123456',purpose:'login'},examples:[
    {name:'✅ 200 Logged in (existing user)',status:200,body:{isNewUser:false,user:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',email:null,fullName:'Sita Rai',avatarUrl:null,status:'active',isPhoneVerified:true,isEmailVerified:false,lastLoginAt:'2026-06-30T10:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-06-30T10:00:00.000Z'}}},
    {name:'✅ 200 Logged in (new user — isNewUser=true)',status:200,body:{isNewUser:true,user:{id:'550e8400-e29b-41d4-a716-446655440001',phone:'+9779800000002',email:null,fullName:null,avatarUrl:null,status:'active',isPhoneVerified:true,isEmailVerified:false,lastLoginAt:null,createdAt:'2026-06-30T10:00:00.000Z',updatedAt:'2026-06-30T10:00:00.000Z'}}},
    {name:'❌ 401 Wrong OTP code',status:401,reqBody:{phone:'{{testPhone}}',otp:'000000',purpose:'login'},body:e(401,'INVALID_OTP','The OTP you entered is incorrect.')},
    {name:'❌ 401 Max attempts exceeded (account locked)',status:401,reqBody:{phone:'{{testPhone}}',otp:'000000',purpose:'login'},body:e(401,'OTP_MAX_ATTEMPTS','Too many incorrect attempts. Please request a new OTP.')},
    {name:'❌ 403 Account suspended',status:403,reqBody:{phone:'{{testPhone}}',otp:'123456',purpose:'login'},body:e(403,'ACCOUNT_SUSPENDED','Your account has been suspended. Contact support.')},
    exV({phone:'{{testPhone}}',otp:'abcdef',purpose:'login'},'OTP must be exactly 6 digits','❌ 400 OTP non-numeric'),
    exV({phone:'{{testPhone}}',otp:'1234',purpose:'login'},'OTP must be exactly 6 digits','❌ 400 OTP too short (4 digits)'),
    exV({},'phone should not be empty, otp should not be empty, purpose must be one of: login, register, reset_phone','❌ 400 All fields missing'),
  ],tests:["if(pm.response.code===200&&pm.response.json().user){pm.collectionVariables.set('userId',pm.response.json().user.id);}"]},
  {name:'Register',method:'POST',path:'/auth/register',skipAuth:true,body:{phone:'{{testPhone}}',fullName:'Sita Rai',email:'sita@example.com'},examples:[
    {name:'✅ 201 Registered',status:201,body:{user:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',email:'sita@example.com',fullName:'Sita Rai',avatarUrl:null,status:'active',isPhoneVerified:true,isEmailVerified:false,lastLoginAt:null,createdAt:'2026-06-30T10:00:00.000Z',updatedAt:'2026-06-30T10:00:00.000Z'}}},
    {name:'❌ 400 Phone not OTP-verified yet',status:400,reqBody:{phone:'+9779800000099',fullName:'Ghost User'},body:e(400,'PHONE_NOT_VERIFIED','Please verify your phone number with an OTP before registering.')},
    {name:'❌ 409 Phone already registered',status:409,reqBody:{phone:'{{testPhone}}',fullName:'Sita Rai'},body:e(409,'PHONE_TAKEN','An account with this phone number already exists.')},
    exV({phone:'{{testPhone}}',fullName:'A'},'fullName must be longer than or equal to 2 characters','❌ 400 fullName too short'),
    exV({phone:'{{testPhone}}'},'fullName should not be empty','❌ 400 fullName missing'),
  ]},
  {name:'Refresh Token',method:'POST',path:'/auth/refresh',skipAuth:true,examples:[
    {name:'✅ 200 Session refreshed',status:200,body:{message:'Session refreshed successfully.'}},
    {name:'❌ 401 No refresh cookie',status:401,body:e(401,'MISSING_REFRESH_TOKEN','No refresh token found. Please log in again.')},
    {name:'❌ 401 Token expired',status:401,body:e(401,'REFRESH_TOKEN_EXPIRED','Your session has expired. Please log in again.')},
    {name:'❌ 401 Token invalid',status:401,body:e(401,'INVALID_REFRESH_TOKEN','Invalid refresh token.')},
    {name:'❌ 403 Token reuse detected — all sessions revoked',status:403,body:e(403,'REFRESH_TOKEN_REUSE_DETECTED','Suspicious activity detected. All sessions revoked. Please log in again.')},
  ]},
  {name:'Logout',method:'POST',path:'/auth/logout',examples:[
    {name:'✅ 200 Logged out',status:200,body:{message:'Logged out successfully.'}},
    exU(),
  ]},
  {name:'Get Current User',method:'GET',path:'/auth/me',
    tests:["if(pm.response.code===200){pm.collectionVariables.set('userId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 200 OK',status:200,body:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',email:null,fullName:'Sita Rai',avatarUrl:null,status:'active',isPhoneVerified:true,isEmailVerified:false,lastLoginAt:'2026-06-30T10:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-06-30T10:00:00.000Z'}},
    exU(),
  ]},
]},

{name:'Shops',items:[
  {name:'Create Shop',method:'POST',path:'/shops',
    body:{name:'Sita Fashion House',slug:'sita-fashion-house',description:'Authentic Nepali fashion',businessAddress:'Thamel, Kathmandu',businessPhone:'+9779841234567',panNumber:'123456789'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('shopId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created',status:201,body:{id:'660e8400-e29b-41d4-a716-446655440001',name:'Sita Fashion House',slug:'sita-fashion-house',description:'Authentic Nepali fashion',status:'pending',logoUrl:null,businessAddress:'Thamel, Kathmandu',businessPhone:'+9779841234567',panNumber:'123456789',avgRating:'0.00',totalReviews:0,createdAt:'2026-06-30T10:00:00.000Z'}},
    {name:'✅ 201 Created (auto-generated slug)',status:201,reqBody:{name:'Annapurna Textiles'},body:{id:'660e8400-e29b-41d4-a716-446655440002',name:'Annapurna Textiles',slug:'annapurna-textiles',status:'pending',avgRating:'0.00',totalReviews:0,createdAt:'2026-06-30T10:00:00.000Z'}},
    {name:'❌ 403 Phone not verified',status:403,body:e(403,'PHONE_NOT_VERIFIED','Phone number must be verified before creating a shop.')},
    {name:'❌ 409 User already owns a shop',status:409,body:e(409,'SHOP_ALREADY_EXISTS','You already own a shop. Only one shop per user is allowed.')},
    {name:'❌ 409 Slug already taken',status:409,reqBody:{name:'Another Shop',slug:'sita-fashion-house'},body:e(409,'SLUG_TAKEN','The slug "sita-fashion-house" is already taken.')},
    exV({},'name should not be empty','❌ 400 name missing'),
    exV({name:'AB'},'name must be longer than or equal to 3 characters','❌ 400 name too short'),
    exV({name:'A'.repeat(101)},'name must be shorter than or equal to 100 characters','❌ 400 name too long'),
    exV({name:'Test Shop',slug:'Has Spaces!'},'Slug must be lowercase letters, numbers, and hyphens only','❌ 400 invalid slug format'),
    exU({name:'Test Shop'}),
  ]},
  {name:'Get Shop by Slug',method:'GET',path:'/shops/sita-fashion-house',skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:{id:'660e8400-e29b-41d4-a716-446655440001',name:'Sita Fashion House',slug:'sita-fashion-house',description:'Authentic Nepali fashion',status:'active',logoUrl:null,businessAddress:'Thamel, Kathmandu',businessPhone:'+9779841234567',panNumber:'123456789',avgRating:'4.50',totalReviews:23,createdAt:'2026-01-01T00:00:00.000Z'}},
    exNF('SHOP_NOT_FOUND','Shop "nonexistent-shop-xyz" not found'),
  ]},
  {name:'Update Shop',method:'PATCH',path:'/shops/{{shopId}}',
    body:{name:'Updated Shop Name',description:'Updated description',businessPhone:'+9779841234567',businessAddress:'New Baneshwor, Kathmandu'},
    examples:[
    {name:'✅ 200 Updated',status:200,body:{id:'660e8400-e29b-41d4-a716-446655440001',name:'Updated Shop Name',slug:'sita-fashion-house',description:'Updated description',status:'active',businessAddress:'New Baneshwor, Kathmandu',businessPhone:'+9779841234567',avgRating:'4.50',totalReviews:23,createdAt:'2026-01-01T00:00:00.000Z'}},
    exNF('SHOP_NOT_FOUND','Shop not found'),
    {name:'❌ 403 Not your shop',status:403,body:e(403,'INSUFFICIENT_PERMISSIONS','You do not have permission to update this shop.')},
    exU({name:'Updated Name'}),
  ]},
  {name:'Get Shop Subscription',method:'GET',path:'/shops/{{shopId}}/subscription',examples:[
    {name:'✅ 200 OK',status:200,body:{planSlug:'starter',planName:'Starter',status:'trialing',trialEndsAt:'2026-07-30T00:00:00.000Z',currentPeriodEnd:'2026-07-30T00:00:00.000Z'}},
    exNF('SUBSCRIPTION_NOT_FOUND','No subscription found for this shop'),
    exU(),
  ]},
  {name:'Get Shop Usage',method:'GET',path:'/shops/{{shopId}}/usage',examples:[
    {name:'✅ 200 OK',status:200,body:{totalProducts:12,totalVariants:45,totalStaffMembers:2,storageMbUsed:128.5}},
    exNF('USAGE_NOT_FOUND','Resource usage not found for this shop'),
    exU(),
  ]},
  {name:'Get Shop Members',method:'GET',path:'/shops/{{shopId}}/members',examples:[
    {name:'✅ 200 OK',status:200,body:[{userId:'550e8400-e29b-41d4-a716-446655440000',role:'owner',phone:'+9779841234567',fullName:'Sita Rai'},{userId:'550e8400-e29b-41d4-a716-446655440010',role:'manager',phone:'+9779841234568',fullName:'Ram Shrestha'}]},
    exU(),
  ]},
]},

{name:'Categories',items:[
  {name:'Get Category Tree',method:'GET',path:'/categories',skipAuth:true,
    tests:["if(pm.response.code===200){const a=pm.response.json();if(Array.isArray(a)&&a.length)pm.collectionVariables.set('categoryId',a[0].id);}"],
    examples:[
    {name:'✅ 200 OK — with nested children',status:200,body:[{id:'770e8400-e29b-41d4-a716-446655440002',name:'Women',slug:'women',path:'women',parentId:null,imageUrl:null,sortOrder:0,children:[{id:'770e8400-e29b-41d4-a716-446655440003',name:'Sarees',slug:'sarees',path:'women.sarees',parentId:'770e8400-e29b-41d4-a716-446655440002',imageUrl:null,sortOrder:0,children:[]}]},{id:'770e8400-e29b-41d4-a716-446655440020',name:'Men',slug:'men',path:'men',parentId:null,imageUrl:null,sortOrder:1,children:[]}]},
  ]},
  {name:'Get Category by Slug',method:'GET',path:'/categories/women',skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:{id:'770e8400-e29b-41d4-a716-446655440002',name:'Women',slug:'women',path:'women',parentId:null,imageUrl:null,sortOrder:0}},
    exNF('CATEGORY_NOT_FOUND','Category "does-not-exist-xyz" not found'),
  ]},
  {name:'Get Subtree IDs',method:'GET',path:'/categories/{{categoryId}}/subtree-ids',skipAuth:true,
    description:'GiST-indexed ltree query — returns the category itself plus all descendants.',
    examples:[
    {name:'✅ 200 OK',status:200,body:['770e8400-e29b-41d4-a716-446655440002','770e8400-e29b-41d4-a716-446655440003']},
    exNF('CATEGORY_NOT_FOUND','Category not found'),
  ]},
  {name:'Get Breadcrumb',method:'GET',path:'/categories/{{categoryId}}/breadcrumb',skipAuth:true,examples:[
    {name:'✅ 200 OK (subcategory — 2 levels)',status:200,body:[{id:'770e8400-e29b-41d4-a716-446655440002',name:'Women',slug:'women'},{id:'770e8400-e29b-41d4-a716-446655440003',name:'Sarees',slug:'sarees'}]},
    {name:'✅ 200 OK (top-level — 1 item)',status:200,body:[{id:'770e8400-e29b-41d4-a716-446655440002',name:'Women',slug:'women'}]},
  ]},
]},

{name:'Attributes',items:[
  {name:'Get All Attributes',method:'GET',path:'/attributes',skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:[{id:'880e8400-e29b-41d4-a716-446655440004',name:'Color',code:'color',inputType:'swatch',options:[{id:'880e8400-e29b-41d4-a716-446655440005',label:'Red',value:'red',colorHex:'#FF0000',sortOrder:0},{id:'880e8400-e29b-41d4-a716-446655440006',label:'Blue',value:'blue',colorHex:'#0000FF',sortOrder:1}]},{id:'880e8400-e29b-41d4-a716-446655440007',name:'Size',code:'size',inputType:'select',options:[{id:'880e8400-e29b-41d4-a716-446655440008',label:'M',value:'m',colorHex:null,sortOrder:0},{id:'880e8400-e29b-41d4-a716-446655440009',label:'L',value:'l',colorHex:null,sortOrder:1}]}]},
  ]},
  {name:'Get Attribute by Code (color)',method:'GET',path:'/attributes/code/color',skipAuth:true,
    tests:["if(pm.response.code===200){const b=pm.response.json();pm.collectionVariables.set('colorAttributeId',b.id);if(b.options&&b.options.length)pm.collectionVariables.set('colorOptionId',b.options[0].id);}"],
    examples:[
    {name:'✅ 200 OK',status:200,body:{id:'880e8400-e29b-41d4-a716-446655440004',name:'Color',code:'color',inputType:'swatch',options:[{id:'880e8400-e29b-41d4-a716-446655440005',label:'Red',value:'red',colorHex:'#FF0000',sortOrder:0}]}},
    exNF('ATTRIBUTE_NOT_FOUND','Attribute "not-a-real-attribute" not found'),
  ]},
  {name:'Get Attributes for Category',method:'GET',path:'/attributes/category/{{categoryId}}',skipAuth:true,examples:[
    {name:'✅ 200 OK — with attribute flags',status:200,body:[{id:'880e8400-e29b-41d4-a716-446655440004',name:'Color',code:'color',inputType:'swatch',options:[],isRequired:true,isVariantAttribute:true},{id:'880e8400-e29b-41d4-a716-446655440007',name:'Size',code:'size',inputType:'select',options:[],isRequired:true,isVariantAttribute:true}]},
    {name:'✅ 200 OK — no attributes configured',status:200,body:[]},
    exNF('CATEGORY_NOT_FOUND','Category not found'),
  ]},
]},

{name:'Products',items:[
  {name:'Browse Products',method:'GET',path:'/products',skipAuth:true,
    query:[{key:'q',value:'saree'},{key:'sort',value:'newest'},{key:'page',value:'1'},{key:'limit',value:'20'}],
    examples:[
    {name:'✅ 200 OK — with results',status:200,body:{data:[{id:'990e8400-e29b-41d4-a716-446655440006',name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',status:'active',avgRating:'4.30',totalSold:142,isFeatured:false,isTrending:true,primaryImageUrl:'https://res.cloudinary.com/demo/image/upload/saree.jpg',minPriceNpr:'999.00',maxPriceNpr:'2499.00',activeVariantCount:3}],meta:{total:120,page:1,limit:20,totalPages:6,hasNextPage:true,hasPrevPage:false}}},
    {name:'✅ 200 OK — empty results',status:200,body:{data:[],meta:{total:0,page:1,limit:20,totalPages:0,hasNextPage:false,hasPrevPage:false}}},
    {name:'✅ 200 OK — last page (hasPrevPage=true)',status:200,body:{data:[{id:'aa1e8400-e29b-41d4-a716-446655440099',name:'Dhaka Topi - Classic',slug:'dhaka-topi-classic',status:'active',avgRating:'4.80',totalSold:8,isFeatured:false,isTrending:false,primaryImageUrl:null,minPriceNpr:'450.00',maxPriceNpr:'450.00',activeVariantCount:1}],meta:{total:120,page:6,limit:20,totalPages:6,hasNextPage:false,hasPrevPage:true}}},
    exV(undefined,'sort must be one of the following values: newest, price_asc, price_desc, popular, rating','❌ 400 Invalid sort (?sort=invalid_sort)'),
    exV(undefined,'limit must not be greater than 100','❌ 400 limit exceeds max (?limit=999)'),
    exV(undefined,'minPrice must not be less than 0','❌ 400 Negative minPrice (?minPrice=-100)'),
  ]},
  {name:'Get Product by Slug',method:'GET',path:'/products/nepali-silk-saree-red',skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:{id:'990e8400-e29b-41d4-a716-446655440006',name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',status:'active',avgRating:'4.30',totalSold:142,isFeatured:false,isTrending:true,primaryImageUrl:'https://res.cloudinary.com/demo/image/upload/saree.jpg',minPriceNpr:'999.00',maxPriceNpr:'2499.00',activeVariantCount:3,variants:[{id:'aa0e8400-e29b-41d4-a716-446655440007',sku:'SILK-RED-L-001',name:'Red - L',price:'1299.00',compareAtPrice:'1500.00',isActive:true,imageUrl:null}],media:[{id:'aa0e8400-e29b-41d4-a716-446655440008',url:'https://res.cloudinary.com/demo/image/upload/saree.jpg',type:'image',isPrimary:true,sortOrder:0}]}},
    exNF('PRODUCT_NOT_FOUND','Product not found'),
  ]},
  {name:'[CMS] Create Product',method:'POST',path:'/cms/products',
    query:[{key:'shopId',value:'{{shopId}}'}],
    body:{name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',description:'Handwoven silk saree from Bhaktapur artisans.',shortDescription:'Premium handwoven Nepali silk',fabricInfo:'100% pure silk',sizeChart:'S=32", M=34", L=36", XL=38"',categoryId:'{{categoryId}}',metaTitle:'Buy Nepali Silk Saree Online | Mayalu',metaDescription:'Shop authentic handwoven silk sarees from Nepal.'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('productId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created (draft)',status:201,body:{id:'990e8400-e29b-41d4-a716-446655440006',name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',status:'draft',avgRating:'0.00',totalSold:0,isFeatured:false,isTrending:false,primaryImageUrl:null,minPriceNpr:null,maxPriceNpr:null,activeVariantCount:0,variants:[],media:[]}},
    {name:'❌ 409 Slug already taken in this shop',status:409,body:e(409,'SLUG_TAKEN','A product with this slug already exists in your shop.')},
    {name:'❌ 403 Plan limit reached (maxProducts)',status:403,body:e(403,'PLAN_LIMIT_REACHED','Your Starter plan allows a maximum of 50 products. Upgrade to add more.')},
    exV({slug:'my-product'},'name should not be empty','❌ 400 name missing'),
    exV({name:'Test',slug:'a'.repeat(81)},'slug must be shorter than or equal to 80 characters','❌ 400 slug too long'),
    exU({name:'Test',slug:'test'}),
  ]},
  {name:'[CMS] Get Product by ID',method:'GET',path:'/cms/products/{{productId}}',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 OK',status:200,body:{id:'990e8400-e29b-41d4-a716-446655440006',name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',status:'draft',variants:[],media:[]}},
    exNF('PRODUCT_NOT_FOUND','Product not found'),
  ]},
  {name:'[CMS] Update Product',method:'PATCH',path:'/cms/products/{{productId}}',
    query:[{key:'shopId',value:'{{shopId}}'}],body:{name:'Updated Product Name',isFeatured:true,isTrending:true},examples:[
    {name:'✅ 200 Updated',status:200,body:{id:'990e8400-e29b-41d4-a716-446655440006',name:'Updated Product Name',isFeatured:true,isTrending:true,status:'draft'}},
    exNF('PRODUCT_NOT_FOUND','Product not found'),
  ]},
  {name:'[CMS] Add Variant',method:'POST',path:'/cms/products/{{productId}}/variants',
    query:[{key:'shopId',value:'{{shopId}}'}],
    body:{name:'Red - L',sku:'SILK-RED-L-001',price:1299,compareAtPrice:1500,costPrice:800,initialStock:200,attributeValues:[{attributeId:'{{colorAttributeId}}',attributeOptionId:'{{colorOptionId}}'}]},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('variantId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created',status:201,body:{id:'aa0e8400-e29b-41d4-a716-446655440007',sku:'SILK-RED-L-001',name:'Red - L',price:'1299.00',compareAtPrice:'1500.00',isActive:true,imageUrl:null}},
    {name:'❌ 409 SKU already taken (globally unique)',status:409,body:e(409,'SKU_TAKEN','SKU "SILK-RED-L-001" is already in use.')},
    {name:'❌ 403 Plan limit reached (maxVariantsPerProduct)',status:403,body:e(403,'PLAN_LIMIT_REACHED','Your plan allows a maximum of 10 variants per product.')},
    exV({name:'Red - L'},'sku should not be empty, price must be a number','❌ 400 sku/price missing'),
  ]},
  {name:'[CMS] Get Presigned Upload URL',method:'GET',path:'/cms/products/{{productId}}/media/presign',
    query:[{key:'shopId',value:'{{shopId}}'},{key:'filename',value:'saree-red-front.jpg'}],examples:[
    {name:'✅ 200 OK',status:200,body:{uploadUrl:'https://api.cloudinary.com/v1_1/demo/image/upload',publicId:'mayalu-wears/products/abc123',signature:'9f8e7d6c5b4a',timestamp:1751270400,cloudName:'demo',apiKey:'demo_key'}},
  ]},
  {name:'[CMS] Add Media',method:'POST',path:'/cms/products/{{productId}}/media',
    query:[{key:'shopId',value:'{{shopId}}'}],
    body:{url:'https://res.cloudinary.com/demo/image/upload/v1/mayalu-wears/products/abc123.jpg',publicId:'mayalu-wears/products/abc123',type:'image',altText:'Red Silk Saree - Front View',fileSizeBytes:2048000},
    examples:[
    {name:'✅ 201 Created (first image — becomes primary)',status:201,body:{id:'aa0e8400-e29b-41d4-a716-446655440008',url:'https://res.cloudinary.com/demo/image/upload/v1/mayalu-wears/products/abc123.jpg',type:'image',isPrimary:true,sortOrder:0}},
    {name:'✅ 201 Created (additional image — isPrimary=false)',status:201,body:{id:'aa0e8400-e29b-41d4-a716-446655440009',url:'https://res.cloudinary.com/demo/image/upload/v1/mayalu-wears/products/abc124.jpg',type:'image',isPrimary:false,sortOrder:1}},
  ]},
  {name:'[CMS] Publish Product',method:'POST',path:'/cms/products/{{productId}}/publish',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 Published',status:200,body:{id:'990e8400-e29b-41d4-a716-446655440006',status:'active'}},
    {name:'❌ 400 No variants yet',status:400,body:e(400,'MISSING_VARIANTS','Add at least one variant before publishing.')},
    {name:'❌ 400 No media yet',status:400,body:e(400,'MISSING_MEDIA','Add at least one image before publishing.')},
  ]},
  {name:'[CMS] Archive Product',method:'POST',path:'/cms/products/{{productId}}/archive',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 Archived',status:200,body:{message:'Product archived.'}},
  ]},
  {name:'[CMS] Delete Product',method:'DELETE',path:'/cms/products/{{productId}}',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 Deleted (was draft)',status:200,body:{message:'Product deleted.'}},
    {name:'❌ 400 Cannot delete active product',status:400,body:e(400,'CANNOT_DELETE_ACTIVE','Active products cannot be deleted. Archive it first.')},
  ]},
]},

{name:'Inventory',items:[
  {name:'Create Warehouse',method:'POST',path:'/inventory/warehouses',query:[{key:'shopId',value:'{{shopId}}'}],body:{name:'Main Warehouse - Thamel'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('warehouseId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created (first — becomes default)',status:201,body:{id:'bb0e8400-e29b-41d4-a716-446655440009',name:'Main Warehouse - Thamel',isDefault:true}},
    {name:'✅ 201 Created (additional — isDefault=false)',status:201,reqBody:{name:'Pokhara Branch Warehouse'},body:{id:'bb0e8400-e29b-41d4-a716-44665544000a',name:'Pokhara Branch Warehouse',isDefault:false}},
    exV({},'name should not be empty','❌ 400 name missing'),
    exU({name:'Test'}),
  ]},
  {name:'Get Warehouses',method:'GET',path:'/inventory/warehouses',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 OK',status:200,body:[{id:'bb0e8400-e29b-41d4-a716-446655440009',name:'Main Warehouse - Thamel',isDefault:true}]},
    exU(),
  ]},
  {name:'Get Inventory List',method:'GET',path:'/inventory',query:[{key:'shopId',value:'{{shopId}}'}],
    tests:["if(pm.response.code===200){const a=pm.response.json();if(Array.isArray(a)&&a.length)pm.collectionVariables.set('inventoryId',a[0].inventory_id);}"],
    examples:[
    {name:'✅ 200 OK',status:200,body:[{inventory_id:'cc0e8400-e29b-41d4-a716-44665544000a',sku:'SILK-RED-L-001',quantity_on_hand:200,quantity_reserved:3,quantity_available:197,low_stock_threshold:5}]},
    exV(undefined,'shopId should not be empty','❌ 400 shopId missing'),
    exU(),
  ]},
  {name:'Get Low Stock Items',method:'GET',path:'/inventory/low-stock',query:[{key:'shopId',value:'{{shopId}}'}],examples:[
    {name:'✅ 200 OK — items below threshold',status:200,body:[{inventory_id:'cc0e8400-e29b-41d4-a716-44665544000a',sku:'SILK-RED-L-001',quantity_available:3,low_stock_threshold:5}]},
    {name:'✅ 200 OK — nothing low',status:200,body:[]},
    exU(),
  ]},
  {name:'Adjust Stock',method:'POST',path:'/inventory/adjust',query:[{key:'shopId',value:'{{shopId}}'}],
    body:{variantId:'{{variantId}}',warehouseId:'{{warehouseId}}',delta:50,type:'restock',notes:'Received 50 units from Bhaktapur supplier'},
    examples:[
    {name:'✅ 200 Restock (+50)',status:200,body:{message:'Stock adjusted successfully.'}},
    {name:'✅ 200 Damage write-off (-5)',status:200,reqBody:{variantId:'{{variantId}}',warehouseId:'{{warehouseId}}',delta:-5,type:'damage',notes:'5 units damaged in transit'},body:{message:'Stock adjusted successfully.'}},
    {name:'❌ 400 Insufficient stock for negative delta',status:400,reqBody:{variantId:'{{variantId}}',warehouseId:'{{warehouseId}}',delta:-9999,type:'damage'},body:e(400,'INSUFFICIENT_STOCK','Cannot deduct 9999 units — only 197 currently on hand.')},
    exV({variantId:'{{variantId}}',warehouseId:'{{warehouseId}}',delta:10,type:'teleported'},'type must be one of the following values: restock, adjustment, damage, return, opening','❌ 400 Invalid adjustment type'),
    exV({delta:10},'variantId should not be empty, warehouseId should not be empty, type must be one of the following values: restock, adjustment, damage, return, opening','❌ 400 Missing required fields'),
  ]},
  {name:'Get Inventory Transactions',method:'GET',path:'/inventory/{{inventoryId}}/transactions',examples:[
    {name:'✅ 200 OK',status:200,body:[{id:'dd0e8400-e29b-41d4-a716-44665544000b',type:'restock',quantityDelta:50,quantityAfter:200,createdAt:'2026-06-30T10:00:00.000Z'},{id:'dd0e8400-e29b-41d4-a716-44665544000c',type:'sale',quantityDelta:-2,quantityAfter:198,createdAt:'2026-06-29T08:30:00.000Z'}]},
    exNF('INVENTORY_NOT_FOUND','Inventory row not found'),
  ]},
]},

{name:'Delivery',items:[
  {name:'Get Delivery Zones',method:'GET',path:'/delivery/zones',skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:[{id:'ee0e8400-e29b-41d4-a716-44665544000c',code:'KTM',name:'Kathmandu Valley',type:'inside_valley'},{id:'ee0e8400-e29b-41d4-a716-44665544000d',code:'PKR',name:'Pokhara',type:'outside_valley'},{id:'ee0e8400-e29b-41d4-a716-44665544000e',code:'REMOTE',name:'Remote Areas',type:'remote'}]},
  ]},
  {name:'Check Serviceability',method:'POST',path:'/delivery/check',skipAuth:true,
    body:{destPincode:'44600',shopId:'{{shopId}}',sizeClass:'standard'},
    examples:[
    {name:'✅ 200 Serviceable (Kathmandu — free delivery, COD ok)',status:200,body:{result:'serviceable',buyerMessage:'Delivery in 1-2 business days',availableCarriers:[{name:'Pathao Courier',code:'PATHAO',minDays:1,maxDays:2,costNpr:0,supportsCod:true}],minDeliveryCostNpr:'0',fastestDeliveryDays:1,fromCache:false}},
    {name:'✅ 200 Serviceable (remote — paid, no COD)',status:200,reqBody:{destPincode:'21000',shopId:'{{shopId}}'},body:{result:'serviceable',buyerMessage:'Delivery in 5-7 business days. Cash on delivery not available in this area.',availableCarriers:[{name:'NCM Courier',minDays:5,maxDays:7,costNpr:250,supportsCod:false}],minDeliveryCostNpr:'250',fastestDeliveryDays:5,fromCache:false}},
    {name:'✅ 200 Unserviceable (unknown pincode)',status:200,reqBody:{destPincode:'99999',shopId:'{{shopId}}'},body:{result:'unserviceable',buyerMessage:'Sorry, we do not currently deliver to this pincode.',availableCarriers:[],minDeliveryCostNpr:null,fastestDeliveryDays:null,fromCache:false}},
    {name:'✅ 200 OK — served from 24h cache (fromCache=true)',status:200,body:{result:'serviceable',buyerMessage:'Delivery in 1-2 business days',availableCarriers:[{name:'Pathao Courier',minDays:1,maxDays:2,costNpr:0,supportsCod:true}],minDeliveryCostNpr:'0',fastestDeliveryDays:1,fromCache:true}},
    exV({shopId:'{{shopId}}'},'destPincode should not be empty','❌ 400 destPincode missing'),
    exV({destPincode:'44600'},'shopId should not be empty','❌ 400 shopId missing'),
    exV({destPincode:'44600',shopId:'{{shopId}}',sizeClass:'GIGANTIC'},'sizeClass must be one of the following values: standard, large, extra_large','❌ 400 Invalid sizeClass'),
  ]},
]},

{name:'Cart',items:[
  {name:'Get Cart',method:'GET',path:'/cart',examples:[
    {name:'✅ 200 OK — empty cart',status:200,body:{id:'ff0e8400-e29b-41d4-a716-44665544000d',items:[],itemCount:0,subtotal:'0.00'}},
    {name:'✅ 200 OK — with items',status:200,body:{id:'ff0e8400-e29b-41d4-a716-44665544000d',items:[{id:'110e8400-e29b-41d4-a716-44665544000e',variantId:'aa0e8400-e29b-41d4-a716-446655440007',variantName:'Red - L',sku:'SILK-RED-L-001',quantity:2,priceSnapshot:'1299.00',lineTotal:'2598.00',imageUrl:null}],itemCount:2,subtotal:'2598.00'}},
    exU(),
  ]},
  {name:'Add Item to Cart',method:'POST',path:'/cart/items',body:{variantId:'{{variantId}}',quantity:2},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('cartItemId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Added (new item)',status:201,body:{id:'110e8400-e29b-41d4-a716-44665544000e',variantId:'aa0e8400-e29b-41d4-a716-446655440007',variantName:'Red - L',sku:'SILK-RED-L-001',quantity:2,priceSnapshot:'1299.00',lineTotal:'2598.00',imageUrl:null}},
    {name:'✅ 201 Merged (already in cart — quantities summed)',status:201,body:{id:'110e8400-e29b-41d4-a716-44665544000e',variantId:'aa0e8400-e29b-41d4-a716-446655440007',variantName:'Red - L',sku:'SILK-RED-L-001',quantity:5,priceSnapshot:'1299.00',lineTotal:'6495.00',imageUrl:null}},
    {name:'❌ 400 Insufficient stock',status:400,body:e(400,'INSUFFICIENT_STOCK','Only 3 units available for this variant.')},
    {name:'❌ 400 Variant not found',status:400,reqBody:{variantId:NIL,quantity:1},body:e(400,'VARIANT_NOT_FOUND','Product variant not found.')},
    {name:'❌ 400 Product inactive',status:400,body:e(400,'PRODUCT_INACTIVE','This product is no longer available.')},
    exV({variantId:'{{variantId}}',quantity:0},'quantity must not be less than 1','❌ 400 quantity is 0'),
    exV({variantId:'{{variantId}}',quantity:-5},'quantity must not be less than 1','❌ 400 negative quantity'),
    exV({variantId:'{{variantId}}',quantity:100},'quantity must not be greater than 99','❌ 400 quantity over max (99)'),
    exV({quantity:1},'variantId should not be empty','❌ 400 variantId missing'),
    exV({variantId:'not-a-uuid',quantity:1},'variantId must be a UUID','❌ 400 variantId not a UUID'),
    exU({variantId:'{{variantId}}',quantity:1}),
  ]},
  {name:'Update Cart Item Quantity',method:'PATCH',path:'/cart/items/{{cartItemId}}',body:{quantity:3},examples:[
    {name:'✅ 200 Updated',status:200,body:{id:'110e8400-e29b-41d4-a716-44665544000e',variantId:'aa0e8400-e29b-41d4-a716-446655440007',variantName:'Red - L',sku:'SILK-RED-L-001',quantity:3,priceSnapshot:'1299.00',lineTotal:'3897.00',imageUrl:null}},
    {name:'❌ 400 Insufficient stock for new qty',status:400,body:e(400,'INSUFFICIENT_STOCK','Only 2 units available for this variant.')},
    exNF('CART_ITEM_NOT_FOUND','Cart item not found'),
  ]},
  {name:'Remove Cart Item',method:'DELETE',path:'/cart/items/{{cartItemId}}',examples:[
    {name:'✅ 200 Removed',status:200,body:{message:'Item removed.'}},
    exNF('CART_ITEM_NOT_FOUND','Cart item not found'),
  ]},
  {name:'Clear Cart',method:'DELETE',path:'/cart',examples:[
    {name:'✅ 200 Cleared',status:200,body:{message:'Cart cleared.'}},
  ]},
]},

{name:'Wishlist',items:[
  {name:'Get Wishlist',method:'GET',path:'/wishlist',examples:[
    {name:'✅ 200 OK — empty',status:200,body:[]},
    {name:'✅ 200 OK — with products',status:200,body:[{id:'990e8400-e29b-41d4-a716-446655440006',name:'Nepali Silk Saree - Red',slug:'nepali-silk-saree-red',minPriceNpr:'999.00',primaryImageUrl:'https://res.cloudinary.com/demo/image/upload/saree.jpg'}]},
    exU(),
  ]},
  {name:'Add to Wishlist',method:'POST',path:'/wishlist/{{productId}}',examples:[
    {name:'✅ 201 Added',status:201,body:{message:'Added to wishlist.'}},
    {name:'✅ 201 Already present (idempotent — no error)',status:201,body:{message:'Added to wishlist.'}},
    exNF('PRODUCT_NOT_FOUND','Product not found'),
    exU(),
  ]},
  {name:'Remove from Wishlist',method:'DELETE',path:'/wishlist/{{productId}}',examples:[
    {name:'✅ 200 Removed',status:200,body:{message:'Removed from wishlist.'}},
    exNF('PRODUCT_NOT_FOUND','Product not in wishlist'),
    exU(),
  ]},
]},

{name:'Orders',items:[
  {name:'Place Order',method:'POST',path:'/orders',
    description:'Fully atomic: validates serviceability, detects stale prices, deducts inventory with row lock, increments coupon usage, clears cart, sends SMS — all inside one DB transaction.',
    body:{addressId:'{{addressId}}',paymentMethod:'cod',couponCode:'SAVE10',customerNotes:'Please leave at the gate'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('orderId',pm.response.json().order.id);}"],
    examples:[
    {name:'✅ 201 Order placed',status:201,body:{order:{id:'220e8400-e29b-41d4-a716-44665544000f',orderNumber:'MW-2026-123456',status:'pending',paymentMethod:'cod',paymentStatus:'pending',subtotalAmount:'2598.00',deliveryCharge:'100.00',discountAmount:'259.80',totalAmount:'2438.20',deliveryAddress:{fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel, Kathmandu',city:'Kathmandu',district:'Bagmati',zone:'inside_valley'},items:[{id:'330e8400-e29b-41d4-a716-446655440010',productNameSnap:'Nepali Silk Saree - Red',variantNameSnap:'Red - L',skuSnap:'SILK-RED-L-001',imageUrlSnap:null,priceSnap:'1299.00',quantity:2,totalPrice:'2598.00'}],statusHistory:[{toStatus:'pending',note:null,changedAt:'2026-06-30T10:00:00.000Z'}],createdAt:'2026-06-30T10:00:00.000Z'},stalePriceWarnings:null}},
    {name:'✅ 201 Order placed — with stale-price warning',status:201,reqBody:{addressId:'{{addressId}}',paymentMethod:'cod'},body:{order:{id:'220e8400-e29b-41d4-a716-446655440011',orderNumber:'MW-2026-123457',status:'pending',paymentMethod:'cod',paymentStatus:'pending',subtotalAmount:'2698.00',deliveryCharge:'100.00',discountAmount:'0.00',totalAmount:'2798.00',items:[],statusHistory:[],createdAt:'2026-06-30T10:05:00.000Z'},stalePriceWarnings:['"Red - L": price changed from NPR 1299 → NPR 1349']}},
    {name:'❌ 400 Empty cart',status:400,body:e(400,'EMPTY_CART','Your cart is empty.')},
    {name:'❌ 400 Items unavailable / out of stock',status:400,body:e(400,'ITEMS_UNAVAILABLE','Some items are unavailable or out of stock.')},
    {name:'❌ 400 Delivery unserviceable for this address',status:400,body:e(400,'DELIVERY_UNSERVICEABLE','We do not currently deliver to this address.')},
    {name:'❌ 400 COD not available (remote zone)',status:400,body:e(400,'COD_NOT_AVAILABLE','Cash on delivery is not available for remote areas. Please choose an online payment method.')},
    {name:'❌ 400 Coupon not found',status:400,reqBody:{addressId:'{{addressId}}',paymentMethod:'cod',couponCode:'FAKECOUPON'},body:e(400,'COUPON_NOT_FOUND','Coupon "FAKECOUPON" not found')},
    exNF('ADDRESS_NOT_FOUND','Delivery address not found',{addressId:NIL,paymentMethod:'cod'}),
    exV({paymentMethod:'cod'},'addressId should not be empty','❌ 400 addressId missing'),
    exV({addressId:'{{addressId}}',paymentMethod:'bitcoin'},'paymentMethod must be one of the following values: cod, esewa, fonepay','❌ 400 Invalid paymentMethod'),
    exV({addressId:'{{addressId}}',paymentMethod:'cod',customerNotes:'x'.repeat(501)},'customerNotes must be shorter than or equal to 500 characters','❌ 400 customerNotes too long'),
    exU({addressId:'{{addressId}}',paymentMethod:'cod'}),
  ]},
  {name:'List My Orders',method:'GET',path:'/orders',query:[{key:'status',value:'pending'},{key:'page',value:'1'},{key:'limit',value:'20'}],examples:[
    {name:'✅ 200 OK',status:200,body:{data:[{id:'220e8400-e29b-41d4-a716-44665544000f',orderNumber:'MW-2026-123456',status:'pending',totalAmount:'2438.20',createdAt:'2026-06-30T10:00:00.000Z'}],meta:{total:1,page:1,limit:20,totalPages:1,hasNextPage:false,hasPrevPage:false}}},
    {name:'✅ 200 OK — empty (no orders yet)',status:200,body:{data:[],meta:{total:0,page:1,limit:20,totalPages:0,hasNextPage:false,hasPrevPage:false}}},
    exV(undefined,'status must be one of the following values: pending, confirmed, packed, shipped, delivered, cancelled, returned','❌ 400 Invalid status filter (?status=flying)'),
    exU(),
  ]},
  {name:'Get Order Detail',method:'GET',path:'/orders/{{orderId}}',examples:[
    {name:'✅ 200 OK',status:200,body:{id:'220e8400-e29b-41d4-a716-44665544000f',orderNumber:'MW-2026-123456',status:'pending',paymentMethod:'cod',paymentStatus:'pending',subtotalAmount:'2598.00',deliveryCharge:'100.00',discountAmount:'259.80',totalAmount:'2438.20',items:[{id:'330e8400-e29b-41d4-a716-446655440010',productNameSnap:'Nepali Silk Saree - Red',quantity:2,totalPrice:'2598.00'}],statusHistory:[{toStatus:'pending',note:null,changedAt:'2026-06-30T10:00:00.000Z'}],createdAt:'2026-06-30T10:00:00.000Z'}},
    exNF('ORDER_NOT_FOUND','Order not found or you do not have access to it'),
    exU(),
  ]},
]},

{name:'Coupons',items:[
  {name:'Validate Coupon',method:'POST',path:'/coupons/validate',body:{code:'SAVE10',orderAmount:2598},examples:[
    {name:'✅ 200 Valid — percentage discount',status:200,body:{code:'SAVE10',discountType:'percentage',discountValue:'10.00',discountAmount:259.8,finalAmount:2338.2}},
    {name:'✅ 200 Valid — fixed discount',status:200,reqBody:{code:'FLAT200',orderAmount:2598},body:{code:'FLAT200',discountType:'fixed',discountValue:'200.00',discountAmount:200,finalAmount:2398}},
    {name:'❌ 400 Coupon not found',status:400,reqBody:{code:'FAKECOUPON999',orderAmount:1000},body:e(400,'COUPON_NOT_FOUND','Coupon "FAKECOUPON999" not found')},
    {name:'❌ 400 Coupon expired',status:400,body:e(400,'COUPON_EXPIRED','This coupon has expired.')},
    {name:'❌ 400 Usage limit exhausted',status:400,body:e(400,'COUPON_EXHAUSTED','This coupon has reached its usage limit.')},
    {name:'❌ 400 Per-user limit reached',status:400,body:e(400,'COUPON_USER_LIMIT','You have already used this coupon the maximum number of times.')},
    {name:'❌ 400 Order below minimum amount',status:400,reqBody:{code:'SAVE10',orderAmount:100},body:e(400,'COUPON_MIN_ORDER','This coupon requires a minimum order of NPR 500.')},
    exV({orderAmount:1000},'code should not be empty','❌ 400 code missing'),
    exV({code:'SAVE10'},'orderAmount must be a number','❌ 400 orderAmount missing'),
    exV({code:'SAVE10',orderAmount:0},'orderAmount must be a positive number','❌ 400 orderAmount is 0'),
    exU({code:'SAVE10',orderAmount:1000}),
  ]},
]},

{name:'Reviews',items:[
  {name:'Get Product Reviews',method:'GET',path:'/reviews/product/{{productId}}',skipAuth:true,examples:[
    {name:'✅ 200 OK — with reviews',status:200,body:[{id:'440e8400-e29b-41d4-a716-446655440011',rating:5,comment:'Beautiful fabric, fast delivery! Highly recommend.',status:'approved',user:{fullName:'Sita Rai',avatarUrl:null},createdAt:'2026-06-30T10:00:00.000Z'}]},
    {name:'✅ 200 OK — no reviews yet',status:200,body:[]},
    exNF('PRODUCT_NOT_FOUND','Product not found'),
  ]},
  {name:'Create Review',method:'POST',path:'/reviews/product/{{productId}}',
    body:{orderId:'{{orderId}}',rating:5,comment:'Beautiful fabric, fast delivery! Highly recommend.'},
    examples:[
    {name:'✅ 201 Created (pending moderation)',status:201,body:{id:'440e8400-e29b-41d4-a716-446655440011',rating:5,comment:'Beautiful fabric, fast delivery! Highly recommend.',status:'pending',user:{fullName:'Sita Rai',avatarUrl:null},createdAt:'2026-06-30T10:00:00.000Z'}},
    {name:'❌ 400 Product not in this order',status:400,body:e(400,'PRODUCT_NOT_IN_ORDER','This product was not part of the specified order.')},
    {name:'❌ 400 Order not yet delivered',status:400,body:e(400,'ORDER_NOT_DELIVERED','You can only review products after the order has been delivered.')},
    {name:'❌ 409 Already reviewed',status:409,body:e(409,'REVIEW_ALREADY_EXISTS','You have already reviewed this product.')},
    exV({orderId:'{{orderId}}',rating:0},'rating must not be less than 1','❌ 400 rating below minimum (0)'),
    exV({orderId:'{{orderId}}',rating:6},'rating must not be greater than 5','❌ 400 rating above maximum (6)'),
    exV({rating:5},'orderId should not be empty','❌ 400 orderId missing'),
    exV({orderId:'{{orderId}}',rating:5,comment:'x'.repeat(1001)},'comment must be shorter than or equal to 1000 characters','❌ 400 comment too long'),
    exU({orderId:'{{orderId}}',rating:5}),
  ]},
]},

{name:'Banners',items:[
  {name:'Get Active Banners',method:'GET',path:'/banners',skipAuth:true,query:[{key:'position',value:'hero'}],examples:[
    {name:'✅ 200 OK — hero banners',status:200,body:[{id:'550e8400-e29b-41d4-a716-446655440012',title:'Dashain Mega Sale — Up to 50% Off',subtitle:null,imageUrl:'https://res.cloudinary.com/demo/image/upload/banner.jpg',linkUrl:'/browse?tag=dashain-sale',position:'hero',sortOrder:0,isActive:true}]},
    {name:'✅ 200 OK — no active banners',status:200,body:[]},
    exV(undefined,'position must be one of the following values: hero, category, promo','❌ 400 Invalid position value'),
  ]},
]},

{name:'Notifications',items:[
  {name:'Get Notifications',method:'GET',path:'/notifications',
    tests:["if(pm.response.code===200){const a=pm.response.json();if(Array.isArray(a)&&a.length)pm.collectionVariables.set('notificationId',a[0].id);}"],
    examples:[
    {name:'✅ 200 OK — with notifications',status:200,body:[{id:'660e8400-e29b-41d4-a716-446655440013',type:'order_status',message:'Your order MW-2026-123456 has been shipped!',isRead:false,sentAt:'2026-06-30T10:00:00.000Z'}]},
    {name:'✅ 200 OK — none yet',status:200,body:[]},
    exU(),
  ]},
  {name:'Mark Notification as Read',method:'PATCH',path:'/notifications/{{notificationId}}/read',examples:[
    {name:'✅ 200 Marked read',status:200,body:{message:'Marked as read.'}},
    exNF('NOTIFICATION_NOT_FOUND','Notification not found'),
  ]},
  {name:'Mark All as Read',method:'PATCH',path:'/notifications/read-all',examples:[
    {name:'✅ 200 All marked read',status:200,body:{message:'All notifications marked as read.'}},
  ]},
]},

{name:'Users',items:[
  {name:'Get My Profile',method:'GET',path:'/users/me',examples:[
    {name:'✅ 200 OK',status:200,body:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',email:null,fullName:'Sita Rai',avatarUrl:null,status:'active',isPhoneVerified:true,isEmailVerified:false,lastLoginAt:'2026-06-30T10:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-06-30T10:00:00.000Z'}},
    exU(),
  ]},
  {name:'Update My Profile',method:'PATCH',path:'/users/me',
    body:{fullName:'Sita Rai',email:'sita@example.com',avatarUrl:'https://res.cloudinary.com/demo/image/upload/avatar.jpg'},
    examples:[
    {name:'✅ 200 Updated',status:200,body:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',email:'sita@example.com',fullName:'Sita Rai',avatarUrl:'https://res.cloudinary.com/demo/image/upload/avatar.jpg',status:'active',isPhoneVerified:true,isEmailVerified:false,updatedAt:'2026-06-30T10:00:00.000Z'}},
    {name:'✅ 200 Updated (empty body — no-op, returns unchanged)',status:200,reqBody:{},body:{id:'550e8400-e29b-41d4-a716-446655440000',phone:'+9779800000001',fullName:'Sita Rai',updatedAt:'2026-06-30T10:00:00.000Z'}},
    exV({fullName:'A'},'fullName must be longer than or equal to 2 characters','❌ 400 fullName too short'),
    exV({fullName:'A'.repeat(101)},'fullName must be shorter than or equal to 100 characters','❌ 400 fullName too long'),
    exU({fullName:'Test'}),
  ]},
  {name:'Get My Addresses',method:'GET',path:'/users/me/addresses',examples:[
    {name:'✅ 200 OK — with addresses',status:200,body:[{id:'770e8400-e29b-41d4-a716-446655440014',type:'home',fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel, House 23',landmark:null,city:'Kathmandu',district:'Bagmati',pincode:'44600',zone:'inside_valley',isDefault:true}]},
    {name:'✅ 200 OK — none saved yet',status:200,body:[]},
    exU(),
  ]},
  {name:'Add Delivery Address',method:'POST',path:'/users/me/addresses',
    body:{type:'home',fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel, House 23, Near Kathmandu Guest House',landmark:'Near the blue gate',city:'Kathmandu',district:'Bagmati',pincode:'44600',zone:'inside_valley'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('addressId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created (first address — becomes default)',status:201,body:{id:'770e8400-e29b-41d4-a716-446655440014',type:'home',fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel, House 23, Near Kathmandu Guest House',landmark:'Near the blue gate',city:'Kathmandu',district:'Bagmati',pincode:'44600',zone:'inside_valley',isDefault:true}},
    exV({type:'home'},'fullName should not be empty, phone should not be empty, addressLine should not be empty, city should not be empty, district should not be empty','❌ 400 Required fields missing'),
    exV({type:'home',fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel',city:'Kathmandu',district:'Bagmati',zone:'mars_colony'},'zone must be one of the following values: inside_valley, outside_valley, remote','❌ 400 Invalid zone'),
    exV({type:'submarine',fullName:'Sita Rai',phone:'+9779841234567',addressLine:'Thamel',city:'Kathmandu',district:'Bagmati',zone:'inside_valley'},'type must be one of the following values: home, work, other','❌ 400 Invalid address type'),
    exU({type:'home',fullName:'Test'}),
  ]},
]},

{name:'Navigation',items:[
  {name:'Get Navigation',method:'GET',path:'/navigation',
    description:'Role-based menu, permissions, plan features, and live badge counts. O(1): menu from constants, plan from JSONB snapshot, badges from indexed partial queries — 3 parallel DB calls max.',
    examples:[
    {name:'✅ 200 OK — shop owner',status:200,body:{role:'owner',shopId:'660e8400-e29b-41d4-a716-446655440001',permissions:{canViewDashboard:true,canCreateProduct:true,canEditProduct:true,canDeleteProduct:false,canManageInventory:true,canViewOrders:true,canUpdateOrderStatus:true,canManageCoupons:false,canViewAnalytics:false,canManageBanners:false,canManageStaff:false,canManageSettings:false},planFeatures:{canUseAnalytics:false,canUseDiscounts:true,canUseEsewa:false,canUseBulkImport:false,canUseSeoTools:false},menu:[{id:'orders',label:'Orders',icon:'ShoppingBag',path:'/cms/orders',badgeCount:3}],badges:{pendingOrders:3,unreadNotifications:7}}},
    {name:'✅ 200 OK — plain customer (no shop)',status:200,body:{role:'customer',shopId:null,permissions:{canViewDashboard:false,canCreateProduct:false,canEditProduct:false,canDeleteProduct:false,canManageInventory:false,canViewOrders:false,canUpdateOrderStatus:false,canManageCoupons:false,canViewAnalytics:false,canManageBanners:false,canManageStaff:false,canManageSettings:false},planFeatures:{canUseAnalytics:false,canUseDiscounts:false,canUseEsewa:false,canUseBulkImport:false,canUseSeoTools:false},menu:[{id:'orders',label:'My Orders',icon:'Package',path:'/orders',badgeCount:0}],badges:{pendingOrders:0,unreadNotifications:2}}},
    exU(),
  ]},
]},

{name:'Admin',items:[
  {name:'[Admin] Dashboard',method:'GET',path:'/admin/dashboard',useAdminKey:true,skipAuth:true,examples:[
    {name:'✅ 200 OK',status:200,body:{totalUsers:1240,totalShops:45,totalOrders:3820,totalActiveProducts:890,pendingOrders:12,totalRevenuePaid:485200.5,note:'User/shop/order counts are approximate.'}},
    exAU(),
    {name:'❌ 401 Wrong x-admin-key',status:401,skipAuth:true,headerOverride:{'x-admin-key':'wrong-key-totally'},body:e(401,'INVALID_ADMIN_KEY','Missing or invalid x-admin-key header.')},
  ]},
  {name:'[Admin] List All Orders',method:'GET',path:'/admin/orders',useAdminKey:true,skipAuth:true,query:[{key:'status',value:'pending'},{key:'page',value:'1'},{key:'limit',value:'20'}],examples:[
    {name:'✅ 200 OK',status:200,body:{data:[{id:'220e8400-e29b-41d4-a716-44665544000f',orderNumber:'MW-2026-123456',status:'pending',totalAmount:'2438.20'}],meta:{total:1,page:1,limit:20,totalPages:1,hasNextPage:false,hasPrevPage:false}}},
    exAU(),
  ]},
  {name:'[Admin] Update Order Status',method:'PATCH',path:'/admin/orders/{{orderId}}/status',useAdminKey:true,skipAuth:true,
    body:{status:'shipped',note:'Handed to Pathao courier',paymentReference:'eSewa-TXN-12345'},
    examples:[
    {name:'✅ 200 Updated to shipped (triggers SMS)',status:200,body:{id:'220e8400-e29b-41d4-a716-44665544000f',orderNumber:'MW-2026-123456',status:'shipped'}},
    {name:'✅ 200 Updated to delivered',status:200,reqBody:{status:'delivered'},body:{id:'220e8400-e29b-41d4-a716-44665544000f',status:'delivered'}},
    {name:'❌ 400 Invalid status transition',status:400,reqBody:{status:'pending'},body:e(400,'INVALID_STATUS_TRANSITION','Cannot move order from "shipped" back to "pending".')},
    exV({status:'flying'},'status must be one of the following values: confirmed, packed, shipped, delivered, cancelled, refunded','❌ 400 Invalid status enum'),
    exNF('ORDER_NOT_FOUND','Order not found',{status:'shipped'}),
    exAU({status:'shipped'}),
  ]},
  {name:'[Admin] List All Shops',method:'GET',path:'/admin/shops',useAdminKey:true,skipAuth:true,query:[{key:'page',value:'1'},{key:'limit',value:'20'}],examples:[
    {name:'✅ 200 OK',status:200,body:[{id:'660e8400-e29b-41d4-a716-446655440001',name:'Sita Fashion House',slug:'sita-fashion-house',status:'active'}]},
    exAU(),
  ]},
  {name:'[Admin] Update Shop Status',method:'PATCH',path:'/admin/shops/{{shopId}}/status',useAdminKey:true,skipAuth:true,
    body:{status:'active',verificationStatus:'verified'},
    examples:[
    {name:'✅ 200 Approved & verified',status:200,body:{id:'660e8400-e29b-41d4-a716-446655440001',status:'active',verificationStatus:'verified'}},
    {name:'✅ 200 Suspended',status:200,reqBody:{status:'suspended'},body:{id:'660e8400-e29b-41d4-a716-446655440001',status:'suspended'}},
    exV({status:'flying'},'status must be one of the following values: pending, active, suspended, closed','❌ 400 Invalid status enum'),
    exNF('SHOP_NOT_FOUND','Shop not found',{status:'active'}),
  ]},
  {name:'[Admin] Create Coupon',method:'POST',path:'/admin/coupons',useAdminKey:true,skipAuth:true,
    body:{shopId:null,code:'DASHAIN30',description:'30% off for Dashain festival',discountType:'percentage',discountValue:30,minOrderAmount:500,maxDiscount:1000,usageLimitTotal:100,usageLimitPerUser:1,startsAt:'2026-10-01T00:00:00.000Z',expiresAt:'2026-10-15T23:59:59.000Z'},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('couponId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created (platform-wide)',status:201,body:{id:'880e8400-e29b-41d4-a716-446655440015',code:'DASHAIN30'}},
    {name:'✅ 201 Created (shop-specific, fixed discount)',status:201,reqBody:{shopId:'{{shopId}}',code:'SITA200',discountType:'fixed',discountValue:200},body:{id:'880e8400-e29b-41d4-a716-446655440016',code:'SITA200'}},
    exV({code:'TEST'},'discountType must be one of the following values: percentage, fixed, discountValue must be a number','❌ 400 Missing required fields'),
    exV({code:'TEST10',discountType:'barter',discountValue:10},'discountType must be one of the following values: percentage, fixed','❌ 400 Invalid discountType'),
    exAU({code:'TEST10',discountType:'percentage',discountValue:10}),
  ]},
  {name:'[Admin] Toggle Coupon',method:'PATCH',path:'/admin/coupons/{{couponId}}/toggle',useAdminKey:true,skipAuth:true,examples:[
    {name:'✅ 200 Toggled active → inactive',status:200,body:{message:'Coupon state toggled.'}},
    exNF('COUPON_NOT_FOUND','Coupon not found'),
  ]},
  {name:'[Admin] Create Banner',method:'POST',path:'/admin/banners',useAdminKey:true,skipAuth:true,
    body:{shopId:null,title:'Dashain Mega Sale — Up to 50% Off',imageUrl:'https://res.cloudinary.com/demo/image/upload/banner.jpg',publicId:'mayalu-wears/banners/dashain',linkUrl:'/browse?tag=dashain-sale',position:'hero',sortOrder:0},
    tests:["if(pm.response.code===201){pm.collectionVariables.set('bannerId',pm.response.json().id);}"],
    examples:[
    {name:'✅ 201 Created',status:201,body:{id:'550e8400-e29b-41d4-a716-446655440012',title:'Dashain Mega Sale — Up to 50% Off',position:'hero',isActive:true}},
    exV({title:'Test'},'imageUrl should not be empty, publicId should not be empty, position must be one of the following values: hero, category, promo','❌ 400 Missing required fields'),
    exV({title:'Test',imageUrl:'https://example.com/x.jpg',publicId:'x',position:'billboard'},'position must be one of the following values: hero, category, promo','❌ 400 Invalid position'),
    exAU({title:'Test'}),
  ]},
  {name:'[Admin] Toggle Banner',method:'PATCH',path:'/admin/banners/{{bannerId}}/toggle',useAdminKey:true,skipAuth:true,examples:[
    {name:'✅ 200 Toggled',status:200,body:{message:'Banner state toggled.'}},
    exNF('BANNER_NOT_FOUND','Banner not found'),
  ]},
  {name:'[Admin] Get Pending Reviews',method:'GET',path:'/admin/reviews/pending',useAdminKey:true,skipAuth:true,query:[{key:'page',value:'1'}],
    tests:["if(pm.response.code===200){const a=pm.response.json();if(Array.isArray(a)&&a.length)pm.collectionVariables.set('reviewId',a[0].id);}"],
    examples:[
    {name:'✅ 200 OK — pending reviews',status:200,body:[{id:'440e8400-e29b-41d4-a716-446655440011',rating:5,comment:'Beautiful fabric, fast delivery!',status:'pending'}]},
    {name:'✅ 200 OK — queue empty',status:200,body:[]},
    exAU(),
  ]},
  {name:'[Admin] Approve Review',method:'PATCH',path:'/admin/reviews/{{reviewId}}/approve',useAdminKey:true,skipAuth:true,
    description:'Approves the review and atomically recalculates the product avgRating and totalReviews.',
    examples:[
    {name:'✅ 200 Approved',status:200,body:{id:'440e8400-e29b-41d4-a716-446655440011',status:'approved'}},
    exNF('REVIEW_NOT_FOUND','Review not found'),
  ]},
]},
];

function buildUrl(p,q){const r='{{baseUrl}}'+p+(q&&q.length?'?'+q.map(x=>x.key+'='+x.value).join('&'):'');return{raw:r,host:['{{baseUrl}}'],path:p.split('/').filter(Boolean),query:(q||[]).map(x=>({key:x.key,value:x.value}))}}
function buildH(spec,ex){const h=[];if(spec.body||(ex&&ex.reqBody))h.push({key:'Content-Type',value:'application/json'});if(spec.useAdminKey&&!(ex&&ex.noAdminKey))h.push({key:'x-admin-key',value:(ex&&ex.headerOverride&&ex.headerOverride['x-admin-key'])||'{{adminKey}}'});return h;}
function buildItem(spec){
  const mh=buildH(spec,{});
  const req={method:spec.method,header:mh,url:buildUrl(spec.path,spec.query)};
  if(spec.description)req.description=spec.description;
  if(spec.body)req.body={mode:'raw',raw:JSON.stringify(spec.body,null,2),options:{raw:{language:'json'}}};
  const item={name:spec.name,request:req,response:[]};
  for(const ex of(spec.examples||[])){
    const exb=ex.reqBody!==undefined?ex.reqBody:spec.body;
    const exh=buildH(spec,ex);
    const exReq={method:spec.method,header:exh,url:buildUrl(spec.path,spec.query)};
    if(exb)exReq.body={mode:'raw',raw:JSON.stringify(exb,null,2),options:{raw:{language:'json'}}};
    item.response.push({name:ex.name,originalRequest:exReq,status:'OK',code:ex.status,_postman_previewlanguage:'json',header:[{key:'Content-Type',value:'application/json'}],body:JSON.stringify(ex.body,null,2)});
  }
  if(spec.tests&&spec.tests.length)item.event=[{listen:'test',script:{type:'text/javascript',exec:spec.tests}}];
  return item;
}

const collection={
  info:{_postman_id:crypto.randomUUID(),name:'Mayalu Wears API',
    description:'Nepal-focused multi-vendor fashion marketplace — 72 endpoints, 17 modules, 258 example responses. Auth uses HttpOnly cookies: run Auth > Verify OTP & Login first; cookie jar handles the rest automatically. Every request has multiple saved Examples showing success, validation errors, 401/403/404/409 and business-logic edge cases.',
    schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
  item:FOLDERS.map(f=>({name:f.name,item:f.items.map(buildItem)})),
  variable:VARS.map(v=>({key:v.key,value:v.value,type:'string',description:v.description})),
};

const environment={id:crypto.randomUUID(),name:'Mayalu Wears - Local',values:[{key:'baseUrl',value:'http://localhost:8000/api/v1',enabled:true},{key:'adminKey',value:'',enabled:true},{key:'testPhone',value:'+9779800000001',enabled:true}],_postman_variable_scope:'environment'};

fs.writeFileSync('mayalu-wears.postman_collection.json',JSON.stringify(collection,null,2));
fs.writeFileSync('mayalu-wears.postman_environment.json',JSON.stringify(environment,null,2));

const totalReq=FOLDERS.reduce((s,f)=>s+f.items.length,0);
const totalEx=FOLDERS.reduce((s,f)=>s+f.items.reduce((ss,i)=>ss+(i.examples?i.examples.length:0),0),0);
console.log(`✓ ${FOLDERS.length} folders, ${totalReq} requests, ${totalEx} example responses`);
