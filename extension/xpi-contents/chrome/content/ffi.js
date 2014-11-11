/*
 * Copyright (c) 2014, Intel Corporation
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, 
 *   this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, 
 *   this list of conditions and the following disclaimer in the documentation 
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF 
 * THE POSSIBILITY OF SUCH DAMAGE.
 *
 */


// This code makes OpenCL API functions available to JavaScript
// through the js-ctypes interface.

// Import the ctypes library.
Components.utils.import("resource://gre/modules/ctypes.jsm");

// For restartlessness and other services.
Components.utils.import("resource://gre/modules/Services.jsm");

// For debugging.
Components.utils.import("resource://gre/modules/devtools/Console.jsm");

// Here are a few types for which we have no better alternative than
// voidptr_t.  We have no idea how, e.g., the cl_context type is
// actually defined.  From the OpenCL spec: "The context includes a
// set of devices, the memory accessible to those devices, the
// corresponding memory properties and one or more command-queues used
// to schedule execution of a kernel(s) or operations on memory
// objects."  But that's only so helpful, so voidptr_t will have to
// do.
const cl_context = ctypes.voidptr_t;
const cl_context_properties = ctypes.voidptr_t;
const cl_context_info = ctypes.voidptr_t;
const cl_device_id = ctypes.voidptr_t;
const cl_kernel = ctypes.voidptr_t;
const cl_mem = ctypes.voidptr_t;
const cl_platform_id = ctypes.voidptr_t;
const cl_program = ctypes.voidptr_t;
const cl_command_queue = ctypes.voidptr_t;
const cl_event = ctypes.voidptr_t;

// Types that have existing ctypes counterparts:

// cl_uint and cl_int are 32-bit, according to
// https://www.khronos.org/registry/cl/sdk/2.0/docs/man/xhtml/scalarDataTypes.html.
const cl_uint = ctypes.uint32_t;
const cl_int = ctypes.int32_t;

// Enum types.  I'm not really sure what type these should be...
const cl_device_type = ctypes.uint32_t;
const cl_device_info = ctypes.uint32_t;
const cl_mem_flags = ctypes.uint32_t;
const cl_platform_info = ctypes.uint32_t;
const cl_program_info = ctypes.uint32_t;
const cl_program_build_info = ctypes.uint32_t;

// Constants from cl.h (not all of them, just the ones we need):

// Error codes:
const CL_SUCCESS =                                  0;
const CL_MEM_OBJECT_ALLOCATION_FAILURE =           -4;
const CL_OUT_OF_RESOURCES =                        -5;
const CL_OUT_OF_HOST_MEMORY =                      -6;

// cl_context_info variants (for specifying to `clGetContextInfo` what
// we're asking for info about):
const CL_CONTEXT_NUM_DEVICES = 0x1083;

// cl_device_info variants (for specifying to `clGetDeviceInfo` what
// we're asking for info about):
const CL_DEVICE_TYPE_ = 0x1000;
const CL_DEVICE_AVAILABLE = 0x1027;
const CL_DEVICE_NAME = 0x102B;

// cl_platform_info variants (for specifying to `clGetPlatformInfo`
// what we're asking for info about):
const CL_PLATFORM_PROFILE =    0x0900;
const CL_PLATFORM_VERSION =    0x0901;
const CL_PLATFORM_NAME =       0x0902;
const CL_PLATFORM_VENDOR =     0x0903;
const CL_PLATFORM_EXTENSIONS = 0x0904;

// cl_program_info variants (for specifying to `clGetProgramInfo`
// what we're asking for info about):
const CL_PROGRAM_NUM_DEVICES = 0x1162;
const CL_PROGRAM_DEVICES =     0x1163;

// cl_program_build_info variants (for specifying to
// `clGetProgramBuildInfo` what we're asking for info about):
const CL_PROGRAM_BUILD_LOG =   0x1183;

// cl_device_type bitfield variants (returned from `CL_DEVICE_TYPE`
// queries to `clGetDeviceInfo`):
const CL_DEVICE_TYPE_DEFAULT =                     (1 << 0);
const CL_DEVICE_TYPE_CPU =                         (1 << 1);
const CL_DEVICE_TYPE_GPU =                         (1 << 2);
const CL_DEVICE_TYPE_ACCELERATOR =                 (1 << 3);
const CL_DEVICE_TYPE_CUSTOM =                      (1 << 4);
const CL_DEVICE_TYPE_ALL =                         0xFFFFFFFF;

// cl_mem_flags bitfield variants:
const CL_MEM_READ_WRITE =                          (1 << 0);
const CL_MEM_READ_ONLY =                           (1 << 2);
const CL_MEM_USE_HOST_PTR =                        (1 << 3);
const CL_MEM_COPY_HOST_PTR =                       (1 << 5);

// Other handy constants.
const MAX_DEVICE_NAME_LENGTH = 64;
const BUILDLOG_SIZE  = 4096;

// A handy thing to have, since we're going to be checking a lot of
// error codes after calls to js-ctypes-declared functions.
function check(errorCode) {
    let errorCodeValue = typeof(errorCode) === "number" ? errorCode : errorCode.value;
    if (errorCodeValue != CL_SUCCESS) {
        errorString = arguments.callee.caller.name +
            " called a function that returned with error code " +
            errorCodeValue;
        console.log(errorString);
        throw errorString;
    }
}

function _l(s) {
    console.log(s);
}

/*
function RiverTrailExtension() {
   this.OpenCLContext = null; // {
   this.kernelsList = [];
}

function CData() {
    this.
}
*/

// Stuff that ParallelArray.js needs to call.
let ParallelArrayFFI = {

    is64BitFloatingPointEnabled: function() {

        OpenCL.init();

        let prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
        let prefBranch = prefService.getBranch("extensions.river-trail-extension.");
        let defaultPlatformPref = prefBranch.getIntPref("defaultPlatform");
        if (defaultPlatformPref < 0 || defaultPlatformPref === undefined) {
            defaultPlatformPref = 0;
        }

        Platforms.init();
        let allPlatforms = Platforms.jsPlatforms;

        // A string of all supported extensions on the current default
        // platform.
        let defaultPlatform = allPlatforms[defaultPlatformPref];
        let defaultPlatformExtensions = defaultPlatform.extensions;
        console.log("defaultPlatformExtensions: " + defaultPlatformExtensions);

        // Check if 64-bit floating point extension is turned on.
        let retval = defaultPlatformExtensions.indexOf("cl_khr_fp64") !== -1;
        return retval;
    },
};

//var window = Components.utils.waiveXrays(subject);

function OpenCLContext(ctypesObj) {
    this.ctypesObj = ctypesObj;
    this._name = "openclcontexthere";
}

function GenericWrapper(_ctypesObj, _name, _id) {
    this.ctypesObj = _ctypesObj;
    this.name = _name;
    this.id = _id;
    this.__exposedProps__ = {ctypesObj: "rw", name:"rw", id:"rw"};
}

var context;
// Stuff that Driver.js needs to call.
var device;
let DriverFFI = (function() {

    const DeviceArray = new ctypes.ArrayType(cl_device_id, 1);
    let deviceList = new DeviceArray();
    let commandQueue;
    //buildLog: ctypes.char.array()(""),
    var foo = "Jas";
    var failureMem = ctypes.int.array(1)([0]);
    var failureMemCLBuffer;
    var DPO_NUMBER_OF_ARTIFICIAL_ARGS = 1;
    var CL_MEM_SIZE = 8;
    var compiledKernels = [];
    var mappedBuffers = [];
    var mytestingfunction = function() {
        return "Hello";
    };

    var initContext = function(string) {

        OpenCL.init();
        console.log("[Createcontext:: Got] : " + string);
        let prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
        let prefBranch = prefService.getBranch("extensions.river-trail-extension.");
        let defaultPlatformPref = prefBranch.getIntPref("defaultPlatform");
        if (defaultPlatformPref < 0 || defaultPlatformPref === undefined) {
            defaultPlatformPref = 0;
        }
        compiledKernels.length = 0;
        mappedBuffers.length = 0;
        Platforms.init();
        let allPlatforms = Platforms.jsPlatforms;
        let defaultPlatform = allPlatforms[defaultPlatformPref];
        let defaultPlatformID = defaultPlatform.platform_id;

        // A place to put all the error codes we encounter.
        let err_code = new cl_int();
        let err_code_address = err_code.address();

        // Then, get a list of device IDs to pass to
        // `clCreateContext`.
        let ndevices = new cl_uint();
        err_code = OpenCL.clGetDeviceIDs(defaultPlatformID, // platform
                                         CL_DEVICE_TYPE_ALL, // device_type
                                         1, // num_entries
                                         deviceList, // *devices
                                         ndevices.address()); // *num_devices
        check(err_code);
        console.log("Device id: " + deviceList[0]);
        console.log("Number of devices: " + ndevices.value);

        context = OpenCL.clCreateContext(null, // *properties
                                             1, // num_devices
                                             deviceList, // *devices
                                             null, // *pfn_notify
                                             null, // *user_data
                                             err_code_address); // *errcode_ret
        check(err_code);
        console.log("[Created New Context]");

        failureMemCLBuffer = OpenCL.clCreateBuffer(context, CL_MEM_READ_WRITE, 4, null, err_code_address);
        check(err_code);
        commandQueue = OpenCL.clCreateCommandQueue(context, deviceList[0], 0, err_code_address);
        check(err_code);
        return new GenericWrapper(context, "OpenCLContext");

    };

    var canBeMapped = function(obj) {
        // In the original code, this checked to see if obj was a
        // nested dense array of floats.  However, it doesn't seem
        // like we support mapping arrays at all now, so this just
        // returns false.
        return false;

    };

    var compileKernel = function(source, kernelName) {
        console.log("----------------------");
        console.log("----------------------");
        console.log("----------------------");
        console.log("Compiling " + source);
        console.log("Context is : " + typeof(context.name));
        OpenCL.init();
        // A place to put all the error codes we encounter.
        let err_code = new cl_int();
        let err_code_address = err_code.address();

        // `source` is a JS string; we change it to a C string.
        let sourceCString = ctypes.char.array()(source);
        var sizes = ctypes.size_t.array(1) ([sourceCString.length - 1]);
        // It's all one line, but an array of pointers to strings, one
        // for each line, is expected.  So we need a pointer to a
        // pointer to a string.
        
        let program = OpenCL.clCreateProgramWithSource(context,
                                                       1,
                                                       ctypes.cast(sourceCString.address().address(), ctypes.char.ptr.ptr),
                                                       ctypes.cast (sizes.address(), ctypes.size_t.ptr),
                                                       err_code_address);
        check(err_code);

        // Apparently, the options argument to `clBuildProgram` is
        // always an empty string.
        let options = "";
        let optionsCString = ctypes.char.array()(options);

        err_code = OpenCL.clBuildProgram(program, 0, null, optionsCString, null, null);
        check(err_code);


        // Figure out how many devices there are...
        let numDevices = new cl_uint();
        err_code = OpenCL.clGetProgramInfo(program,
                                           CL_PROGRAM_NUM_DEVICES,
                                           cl_uint.size,
                                           numDevices.address(),
                                           null);
        check(err_code);

        // ...so we can get info about them
        const DeviceIDArray = new ctypes.ArrayType(cl_device_id, numDevices.value);
        let deviceIDs = new DeviceIDArray();
        err_code = OpenCL.clGetProgramInfo(program,
                                           CL_PROGRAM_DEVICES,
                                           numDevices.value*cl_device_id.size, // size of deviceIDs
                                           deviceIDs,
                                           null);
        check(err_code);

        // LK: `deviceIDs[0]` is copied from the original code -- I'm
        // not sure how we know we want that one.
        let buildLogSize = BUILDLOG_SIZE;
        let buildLogType = new ctypes.ArrayType(ctypes.char, BUILDLOG_SIZE);
        let buildLog = new buildLogType();
        err_code = OpenCL.clGetProgramBuildInfo(program,
                                                deviceIDs[0],
                                                CL_PROGRAM_BUILD_LOG,
                                                buildLogSize,
                                                buildLog,
                                                null);
        check(err_code);

        kernel = OpenCL.clCreateKernel(program, ctypes.char.array()(kernelName), err_code_address);
        //let wrappedKernel = new GenericWrapper(kernel, "OpenCLKernel", compiledKernels.length);
        check(err_code);
        err_code.value = OpenCL.clSetKernelArg(kernel, 0, CL_MEM_SIZE, failureMemCLBuffer.address());
        check(err_code);
        compiledKernels.push(kernel);
        return compiledKernels.length-1;
    };

    var mapData = function(source) {
        OpenCL.init();
        let err_code = new cl_int();
        let err_code_address = err_code.address();
        let arrayType = ctypes.double.array(5);
        let clbuffer = OpenCL.clCreateBuffer(context, CL_MEM_USE_HOST_PTR, source.byteLength, ctypes.voidptr_t(source.buffer), err_code_address);
        check(err_code);
        mappedBuffers.push(clbuffer);
        //return {name:"CData", id:mappedBuffers.length-1};
        return new GenericWrapper(null, "CData", mappedBuffers.length-1);
    };
    var setArgument = function(kernel, index, arg) {
        let err_code = new cl_int();
        let argSize = ctypes.size_t(8);
        err_code.value = OpenCL.clSetKernelArg(compiledKernels[kernel], index+DPO_NUMBER_OF_ARTIFICIAL_ARGS, argSize, ctypes.cast(mappedBuffers[arg].address(), cl_mem.ptr));
        check(err_code);
    };
    var setScalarArgument = function(kernel, index, arg, isInteger, is64BitPrecision) {
        let err_code = new cl_int();
        let argSize = ctypes.size_t(4);
        let argV;
        if(isInteger) {
            argV = ctypes.int(arg);
        }
        else if(!is64BitPrecision) {
            argV = ctypes.float(arg);
        }
        else {
            argV = ctypes.double(arg);
            argSize.value = 8;
        }
        err_code.value = OpenCL.clSetKernelArg(compiledKernels[kernel], index+DPO_NUMBER_OF_ARTIFICIAL_ARGS, argSize, argV.address());
        check(err_code);
    };
    var run = function(kernel, rank, iterSpace, tile) {
        // This likely won't work if cl_event is a stack allocated C struct for eg.
        let writeEvent = new cl_event();
        let runEvent = new cl_event();
        let err_code = new cl_int();
        let zero = new cl_int(0);
        err_code.value = OpenCL.clEnqueueWriteBuffer(commandQueue, failureMemCLBuffer, 0, 0, 4, zero.address(), 0, null, writeEvent.address());  
        check(err_code);
        let rankInteger = new cl_uint(rank|0);
        let globalWorkSize = ctypes.size_t.array(iterSpace.length)(iterSpace);
        for(let i = 0; i < iterSpace.length; i++) {
            globalWorkSize[i].value = iterSpace[i]|0;
        }
        
        err_code.value = OpenCL.clEnqueueNDRangeKernel(commandQueue, compiledKernels[kernel], rankInteger, null, globalWorkSize, null, 1, writeEvent.address(), runEvent.address()); 
        check(err_code);
        let numEvents = new cl_uint();
        numEvents.value = 1;
        err_code.value = OpenCL.clWaitForEvents(numEvents, runEvent.address());
        check(err_code);
        return err_code.value;
    };
    var getBuildLog = function() {
        return "Didn't work ? wonder why";
        return this.buildLog;
    };
    return {
        mytestingfunction: mytestingfunction,
        initContext: initContext,
        canBeMapped: canBeMapped,
        compileKernel: compileKernel,
        mapData: mapData,
        setArgument: setArgument,
        setScalarArgument: setScalarArgument,
        run: run,
        getBuildLog: getBuildLog
    };
})();

let OpenCL = {
    lib: null, // This will point to the OpenCL library object shortly.

    init: function() {
        console.log("OpenCL.init()...");

        let os = Services.appinfo.OS;

        // Depending what OS we're using, we need to open a different OpenCL library.
        if (os == "Darwin") {
            this.lib = ctypes.open("/System/Library/Frameworks/OpenCL.framework/OpenCL");
        } else if (os == "Linux") {
            // TODO: There's probably something more general I can
            // point to here.  This is where libOpenCL.so ends up when
            // I install the Intel OpenCL SDK.
            //this.lib = ctypes.open("/opt/intel/opencl-1.2-4.6.0.92/lib64/libOpenCL.so");
            this.lib = ctypes.open("/usr/lib64/libOpenCL.so");
            if(!this.lib) {
                throw "Could not open OpenCL library";
            }
        } else if (os == "WINNT") {
            throw "TODO: handle Windows";
        } else {
            throw "I'm not sure what OS this is";
        }

        // Set up stubs for functions that we want to talk to from JS.
        // These are documented at
        // https://www.khronos.org/registry/cl/sdk/2.0/docs/man/xhtml/.

        // N.B.: ctypes.default_abi should work on both Linux and Mac,
        // but not Windows.

        this.clGetPlatformIDs = this.lib.declare("clGetPlatformIDs",
                                                 ctypes.default_abi,
                                                 cl_int, // return type: error code
                                                 cl_uint, // in: num_entries
                                                 cl_platform_id.ptr, // in: *platforms
                                                 cl_uint.ptr); // out: *num_platforms
        _l("Initialized clGetPlatformIDs");

        this.clGetPlatformInfo = this.lib.declare("clGetPlatformInfo",
                                                  ctypes.default_abi,
                                                  cl_int, // return type: error code
                                                  cl_platform_id, // platform
                                                  cl_platform_info, // param_name
                                                  ctypes.size_t, // param_value_size
                                                  ctypes.voidptr_t, // *param_value
                                                  ctypes.size_t.ptr); // *param_value_size_ret
        _l("Initialized clGetPlatformInfo");

        this.clGetDeviceIDs = this.lib.declare("clGetDeviceIDs",
                                               ctypes.default_abi,
                                               cl_int, // return type: error code
                                               cl_platform_id, // platform
                                               cl_device_type, // device_type
                                               cl_uint, // num_entries
                                               cl_device_id, // *devices
                                               cl_uint.ptr); // *num_devices
        _l("Initialized clGetDeviceIDs");

        this.clGetDeviceInfo = this.lib.declare("clGetDeviceInfo",
                                               ctypes.default_abi,
                                               cl_int, // return type
                                               cl_device_id, // device
                                               cl_device_info, // param_name
                                               ctypes.size_t, // param_value_size
                                               ctypes.voidptr_t, // *param_value
                                               ctypes.size_t.ptr); // *param_value_size_ret
        _l("Initialized clGetDeviceInfo");


        this.clCreateContext = this.lib.declare("clCreateContext",
                                                ctypes.default_abi,
                                                cl_context, // return type
                                                cl_context_properties, // *properties
                                                cl_uint, // num_devices
                                                cl_device_id, // *devices
                                                ctypes.voidptr_t, // *pfn_notify
                                                ctypes.voidptr_t, // *user_data
                                                cl_int.ptr); // *errcode_ret
        _l("Initialized clCreateContext");

        //var tmpftype = ctypes.FunctionType(ctypes.default_abi, cl_program, [cl_context, cl_uint, ctypes.char.ptr.ptr, ctypes.size_t.ptr, cl_int.ptr]);
        this.clCreateProgramWithSource = this.lib.declare(
            "clCreateProgramWithSource",
            ctypes.default_abi,
            cl_program, // return type: "a valid non-zero program object" or NULL
            cl_context, // context
            cl_uint, // count (length of the strings array)
            ctypes.char.ptr.ptr, // **strings (array of pointers to strings that make up the code)
            ctypes.size_t.ptr, // *lengths (array with length of each string)
            cl_int.ptr); // *errcode_ret
        //this.clCreateProgramWithSource = ctypes.cast(tmpf, tmpftype.ptr);

        this.clBuildProgram = this.lib.declare(
            "clBuildProgram",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_program, // program: the program object
            cl_uint, // num_devices: the number of devices listed in device_list
            cl_device_id, // *device_list
            ctypes.char.ptr, // *options
            ctypes.voidptr_t, // *pfn_notify
            ctypes.voidptr_t); // *user_data

        this.clGetProgramInfo = this.lib.declare(
            "clGetProgramInfo",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_program, // program
            cl_program_info, // param_name
            ctypes.size_t, // param_value_size
            ctypes.voidptr_t, // *param_value
            ctypes.size_t.ptr); // *param_value_size_ret

        this.clGetProgramBuildInfo = this.lib.declare(
            "clGetProgramBuildInfo",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_program, // program
            cl_device_id, // device
            cl_program_build_info, // param_name
            ctypes.size_t, // param_value_size
            ctypes.voidptr_t, // *param_value
            ctypes.size_t.ptr); // *param_value_size_ret

        this.clEnqueueNDRangeKernel = this.lib.declare(
            "clEnqueueNDRangeKernel",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_command_queue,
            cl_kernel,
            cl_uint,
            ctypes.size_t.ptr,
            ctypes.size_t.ptr,
            ctypes.size_t.ptr,
            cl_uint,
            ctypes.voidptr_t,
            ctypes.voidptr_t);


        this.clEnqueueWriteBuffer = this.lib.declare(
            "clEnqueueWriteBuffer",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_command_queue,
            cl_mem,
            ctypes.bool,
            ctypes.size_t,
            ctypes.size_t,
            ctypes.voidptr_t,
            cl_uint,
            ctypes.voidptr_t,
            ctypes.voidptr_t);



        this.clWaitForEvents = this.lib.declare(
            "clWaitForEvents",
            ctypes.default_abi,
            cl_int,
            cl_uint,
            ctypes.voidptr_t);

        this.clSetKernelArg = this.lib.declare(
            "clSetKernelArg",
            ctypes.default_abi,
            cl_int,
            cl_kernel, // return type: kernel object or NULL
            cl_uint,
            ctypes.size_t,
            ctypes.voidptr_t);


        this.clCreateKernel = this.lib.declare(
            "clCreateKernel",
            ctypes.default_abi,
            cl_kernel, // return type: kernel object or NULL
            cl_program, // program
            ctypes.char.ptr, // *kernel_name
            cl_int.ptr); // *errcode_ret

        this.clCreateCommandQueue = this.lib.declare(
            "clCreateCommandQueue",
            ctypes.default_abi,
            cl_command_queue,
            cl_context,
            cl_device_id,
            cl_uint,
            cl_int.ptr);
            

        this.clReleaseProgram = this.lib.declare(
            "clReleaseProgram",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_program); // program

        this.clReleaseKernel = this.lib.declare(
            "clReleaseKernel",
            ctypes.default_abi,
            cl_int, // return type: error code
            cl_kernel); // kernel

        this.clCreateBuffer = this.lib.declare(
            "clCreateBuffer",
            ctypes.default_abi,
            cl_mem, // return type: buffer object or NULL
            cl_context, // context
            cl_mem_flags, // flags
            ctypes.size_t, // size
            ctypes.voidptr_t, // *host_ptr,
            cl_int.ptr); // *errcode_ret
    },

    shutdown: function() {
        console.log("OpenCL.shutdown()...");

        this.lib.close();
    },
};

// Info about all OpenCL platforms.
let Platforms = {
    numPlatforms: new cl_uint(0),

    // A pointer to a ctypes array of platform IDs of supported
    // platforms.  (Should this be a ctypes.ArrayType?  Probably.)
    platforms: new cl_platform_id(null),

    // A JS array of Platform objects.
    jsPlatforms: new Array(),

    // Initializes numPlatforms and platforms.  Should only be called
    // in a context where OpenCL.init() has already been called.
    init: function init() {

        let err_code = new cl_int();

        // |nplatforms| is used to get number of platforms
        // |naplatforms| is used for the number of actual platforms returned into |platforms|
        // |numSupportedPlatforms| is the number of supported platforms found
        let nplatforms = new cl_uint();
        let naplatforms = new cl_uint();
        let numSupportedPlatforms = new cl_uint(0);

        err_code = OpenCL.clGetPlatformIDs(0, null, nplatforms.address());
        check(err_code);

        // All found platforms
        const PlatformsArray = new ctypes.ArrayType(cl_platform_id, nplatforms.value);
        let allPlatforms = new PlatformsArray();

        err_code = OpenCL.clGetPlatformIDs(nplatforms.value,
                                           allPlatforms,
                                           naplatforms.address());
        check(err_code);

        for (let i = 0; i < naplatforms.value; i++) {

            let platform = new Platform(allPlatforms[i]);

            if (this.isSupported(platform.name)) {

                this.platforms[numSupportedPlatforms.value] = allPlatforms[i];
                numSupportedPlatforms.value++;

                this.jsPlatforms.push(platform);
            }
        }
        this.numPlatforms = numSupportedPlatforms;

    },

    isSupported: function(platformName) {
        return (platformName == "Intel(R) OpenCL" || platformName == "Apple");
    }

};

function Platform(platform_id) {
    this.platform_id = this.GetPlatformID(platform_id);
    this.version = this.GetVersion();
    this.name = this.GetName();
    this.vendor = this.GetVendor();
    this.profile = this.GetProfile();
    this.extensions = this.GetExtensions();
    this.deviceNames = this.GetDeviceNames();
}

// paramName: one of the cl_platform_info variants
Platform.prototype.GetPlatformPropertyHelper = function GetPlatformPropertyHelper(paramName) {

    OpenCL.init();

    let err_code = new cl_int();
    let length = new ctypes.size_t();

    // This first call to `clGetPlatformInfo` is just to find out
    // what the appropriate length is.
    err_code = OpenCL.clGetPlatformInfo(this.platform_id,
                                        paramName,
                                        0,
                                        null,
                                        length.address());
    check(err_code);

    // Now that we have a length, we can allocate space for the
    // actual results of the call, and call it for real.

    const PropertyArray = new ctypes.ArrayType(ctypes.char, length.value);
    let propertyBuf = new PropertyArray();
    const SizeTArray = new ctypes.ArrayType(ctypes.size_t, 1);
    let paramValueSizeRet = new SizeTArray();

    err_code = OpenCL.clGetPlatformInfo(this.platform_id,
                                        paramName,
                                        length.value*ctypes.char.size, // size of propertyBuf
                                        propertyBuf,
                                        paramValueSizeRet);
    check(err_code);

    // Return the property as a JS string.
    let jsProperty = propertyBuf.readString();
    return jsProperty;

};

Platform.prototype.GetDeviceNames = function GetDeviceNames() {

    OpenCL.init();

    let err_code = new cl_int();
    let ndevices = new cl_uint();

    // First, find out how many devices there are on this platform.
    err_code = OpenCL.clGetDeviceIDs(this.platform_id,
                                     CL_DEVICE_TYPE_ALL,
                                     0,
                                     null,
                                     ndevices.address());
    check(err_code);

    // Next, get all the device IDs.
    const DeviceIDArray = new ctypes.ArrayType(cl_device_id, ndevices.value);
    let deviceIDs = new DeviceIDArray();

    err_code = OpenCL.clGetDeviceIDs(this.platform_id,
                                     CL_DEVICE_TYPE_ALL,
                                     ndevices,
                                     deviceIDs,
                                     null);
    check(err_code);

    // Get device names.
    let jsDeviceNames = new Array();

    // N.B.: This is enough space for *one* device name.
    const DeviceNameArray = new ctypes.ArrayType(ctypes.char, MAX_DEVICE_NAME_LENGTH);

    for (let i = 0; i < ndevices.value; i++) {
        let deviceNameBuf = new DeviceNameArray();
        let deviceNameSize = new ctypes.size_t();
        err_code = OpenCL.clGetDeviceInfo(deviceIDs[i],
                                          CL_DEVICE_NAME,
                                          MAX_DEVICE_NAME_LENGTH,
                                          deviceNameBuf,
                                          deviceNameSize.address());
        check(err_code);

        let jsDeviceName = deviceNameBuf.readString();

        // Check if the device is supported.  Currently we only
        // support Intel devices.
        if (jsDeviceName.indexOf("Intel(R)") > -1) {
            jsDeviceNames[i] = jsDeviceName;
        } else {
            jsDeviceNames[i] = "Unknown Device";
        }
    }

    // Return all the device names as a JS array of strings.
    return jsDeviceNames;
};

Platform.prototype.GetVersion = function() {
    return this.GetPlatformPropertyHelper(CL_PLATFORM_VERSION);
};

Platform.prototype.GetName = function() {
    return this.GetPlatformPropertyHelper(CL_PLATFORM_NAME);
};

Platform.prototype.GetVendor = function() {
    return this.GetPlatformPropertyHelper(CL_PLATFORM_VENDOR);
};

Platform.prototype.GetProfile = function() {
    return this.GetPlatformPropertyHelper(CL_PLATFORM_PROFILE);
};

Platform.prototype.GetExtensions = function() {
    return this.GetPlatformPropertyHelper(CL_PLATFORM_EXTENSIONS);
};

// Tries to look up the platform ID from the default prefs, unless
// one was passed as an argument.
Platform.prototype.GetPlatformID = function(platform_id) {

    let retval;

    // If we were passed a platform_id, use that.
    if (platform_id !== undefined) {
        retval = platform_id;
    }
    // Otherwise, look up the default pref setting and use it.
    else {
        let prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.river-trail-extension.");
        retval = prefs.getIntPref("defaultPlatform");
    }

    if (retval < 0 || retval >= Platforms.numPlatforms.value) {
        throw "GetPlatformID: Illegal platform_id";
    } else {
        return retval;
    }
};

let Main = {

    run: function run() {

        OpenCL.init();

        // A place to put all the error codes we encounter.
        let err_code = new cl_int();
        let err_code_address = err_code.address();

        // First, get a list of platform IDs, one of which we'll pass
        // to `clGetDeviceIDs`.
        let num_platforms = new cl_uint();
        const PlatformsArray = new ctypes.ArrayType(cl_platform_id, 1);
        let platform_list = new PlatformsArray();
        err_code = OpenCL.clGetPlatformIDs(1, platform_list, num_platforms.address());
        check(err_code);

        // Then, get a list of device IDs to pass to
        // `clCreateContext`.
        const DeviceArray = new ctypes.ArrayType(cl_device_id, 1);
        let device_list = new DeviceArray();
        err_code = OpenCL.clGetDeviceIDs(platform_list[0], // platform
                                         CL_DEVICE_TYPE_CPU, // device_type
                                         1, // num_entries
                                         device_list, // *devices
                                         null); // *num_devices
        check(err_code);

        // Finally, we can create a context.
        context = OpenCL.clCreateContext(null, // *properties
                                             1, // num_devices
                                             device_list, // *devices
                                             null, // *pfn_notify
                                             null, // *user_data
                                             err_code_address); // *errcode_ret
        check(err_code);

        if (err_code == CL_SUCCESS) {
            console.log(context);
            console.log("Congratulations!  You've created OpenCL context " + context + ".");
        }

    },
};
